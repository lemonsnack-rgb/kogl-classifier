# -*- coding: utf-8 -*-
"""
KOGL 파이프라인 서버
프론트엔드 → 이 서버 → 숭실대 API (OCR+메타데이터) → HMC API (유형분류) → Supabase DB 저장
"""

import os
import json
import asyncio
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

# 환경변수
SSU_API_URL = os.environ.get("SSU_API_URL", "http://150.230.114.9:5000")
HMC_API_URL = os.environ.get("HMC_API_URL", "https://ilwang-kogl-hmc-server.hf.space")
RIGHTS_API_URL = os.environ.get("RIGHTS_API_URL", "https://ilwang-kogl-rights-api.hf.space")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

TYPE_MAP = {
    "유형1": "KOGL-1",
    "유형2": "KOGL-2",
    "유형3": "KOGL-3",
    "유형4": "KOGL-4",
}


def _first_str(meta: dict, keys: list):
    """meta에서 keys 순서대로 첫 non-null 값을 문자열로 반환(객체/배열은 JSON 문자열)."""
    for k in keys:
        v = meta.get(k)
        if v is not None:
            if isinstance(v, (dict, list)):
                return json.dumps(v, ensure_ascii=False)
            return str(v)
    return None


def map_ssu_to_work_fields(meta: dict) -> dict:
    """SSU 추출 결과 → 저작물 20항목 매핑 (src/lib/api/ocr.ts mapSSUToWorkFields와 1:1)."""
    if meta.get("keyword") is not None:
        keywords = [str(meta.get("keyword"))]
    elif meta.get("keywords") is not None:
        keywords = [str(meta.get("keywords"))]
    else:
        keywords = None
    return {
        "work_name": _first_str(meta, ["work_title", "work_name", "copyright_kotitle"]),
        "work_type": None,
        "digital_format": _first_str(meta, ["digital_format", "copyright_status"]),
        "description": _first_str(meta, ["description", "copyright_explain"]),
        "keywords": keywords,
        "language": _first_str(meta, ["language"]),
        "created_date": _first_str(meta, ["created_date", "production_date", "copyright_date", "consent_date"]),
        "creator": _first_str(meta, ["copyright_holder", "rights_holder", "ch_co_name"]),
        "copyright_holder": _first_str(meta, ["copyright_holder", "rights_holder", "ch_co_name", "data_controller"]),
        "co_authors": _first_str(meta, ["co_author", "co_authors", "ch_ja_name"]),
        "neighboring_rights_holder": _first_str(meta, ["neighboring_rights_holder", "ch_nr_name"]),
        "disclosure_type": _first_str(meta, ["disclosure_type", "kogl_type", "ri_info"]),
        "copyrightability": _first_str(meta, ["copyrightability"]),
        "non_protected_work": _first_str(meta, ["non_protected_work", "unprotected_work"]),
        "work_for_hire": _first_str(meta, ["work_for_hire"]),
        "commercial_use": _first_str(meta, ["commercial_use", "granted_rights"]),
        "property_rights": _first_str(meta, ["property_rights", "economic_rights", "ri_copyright"]),
        "co_author_consent": _first_str(meta, ["co_author_consent", "consent_status"]),
        "validity_period": _first_str(meta, ["validity_period", "valid_period", "ri_period", "retention_period"]),
        "portrait_rights": _first_str(meta, ["portrait_rights"]),
        "copyright_period": _first_str(meta, ["validity_period", "valid_period", "ri_period"]),
        "usage_scope": _first_str(meta, ["commercial_use", "granted_rights"]),
    }


_TRUE_TOKENS = ("예", "yes", "true", "해당", "포함", "있음", "적용", "동의")
_FALSE_TOKENS = ("아니", "no", "false", "미해당", "없음", "불포함", "미적용", "해당 없음", "해당없음")
_EXPIRED_TOKENS = ("만료", "비보호", "expired", "public domain", "퍼블릭도메인")


def _is_true(v) -> bool:
    if v is None:
        return False
    s = str(v).strip().lower()
    if not s:
        return False
    if any(t in s for t in _FALSE_TOKENS):
        return False
    return any(t in s for t in _TRUE_TOKENS)


def _is_expired(v) -> bool:
    if v is None:
        return False
    s = str(v).lower()
    return any(t in s for t in _EXPIRED_TOKENS)


def resolve_kogl_type(work_meta: dict, hmc_type):
    """SSU 저작물 메타 + HMC 유형 → 저작물별 신유형 판정(후처리 규칙)."""
    non_protected = work_meta.get("non_protected_work")
    work_for_hire = work_meta.get("work_for_hire")
    portrait = work_meta.get("portrait_rights")
    consent = work_meta.get("co_author_consent")

    hmc_valid = hmc_type if hmc_type in ("KOGL-1", "KOGL-2", "KOGL-3", "KOGL-4") else None
    resolved = hmc_valid
    ai_candidate = False
    reason = None
    low_confidence = False

    if _is_true(non_protected) or _is_expired(non_protected):
        resolved = "KOGL-0"
        reason = "비보호(만료)저작물"
    elif _is_true(work_for_hire) and not _is_true(portrait):
        resolved = "KOGL-0"
        reason = "업무상저작물, 초상권 없음"
    else:
        if hmc_valid is None:
            reason = "유형 신호 부족(계약서 판정 없음)"
        else:
            reason = "계약 기반 유형(상업·변경 축)"
        if _is_true(consent):
            ai_candidate = True

    if resolved == "KOGL-0":
        ai_candidate = False

    if not (_is_true(non_protected) or _is_expired(non_protected) or _is_true(work_for_hire) or hmc_valid):
        low_confidence = True

    return {
        "resolved_type": resolved,
        "ai_candidate": ai_candidate,
        "reason": reason,
        "low_confidence": low_confidence,
    }


async def _ssu_extract(client, file_bytes, file_name, document_type):
    files = {"file": (file_name, file_bytes, "application/octet-stream")}
    data = {"document_type": document_type, "consolidate": "true"}
    r = await client.post(f"{SSU_API_URL}/api/llm-extract", files=files, data=data)
    r.raise_for_status()
    return r.json()


# HF Space가 sleeping이면 콜드스타트 중 502/503/504를 반환할 수 있어 재시도로 기상을 기다린다.
_COLD_STATUSES = {502, 503, 504}


async def _post_json_retry(client, url, payload, attempts=6, wait=15.0):
    last = None
    for _ in range(attempts):
        try:
            r = await client.post(url, json=payload)
            if r.status_code in _COLD_STATUSES:
                last = f"HTTP {r.status_code} (콜드스타트 추정)"
                await asyncio.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except httpx.RequestError as e:
            last = f"{type(e).__name__}: {e}"
            await asyncio.sleep(wait)
    raise RuntimeError(f"요청 실패({url}): {last}")


async def _hmc_classify(client, ocr_text, file_name):
    return await _post_json_retry(
        client, f"{HMC_API_URL}/api/predict",
        {"text": ocr_text, "file_name": file_name, "auto_detect_form": True},
    )


async def _rights_predict(client, ocr_text, file_name):
    return await _post_json_retry(
        client, f"{RIGHTS_API_URL}/api/v1/rights/predict",
        {
            "file_name": file_name or "",
            "text": ocr_text,
            "options": {
                "max_length": 512, "max_evidence": 20, "evidence_threshold": 0.7,
                "return_offsets": True, "return_evidence_text": True, "include_debug": False,
            },
        },
    )

app = FastAPI(title="KOGL 파이프라인 서버")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_supabase():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def append_log(sb, contract_id: str, step: str, status: str, detail: str = ""):
    """파이프라인 로그를 DB에 추가"""
    if not sb:
        return
    try:
        # 기존 로그 가져오기
        res = sb.table("contracts").select("pipeline_log").eq("id", contract_id).single().execute()
        logs = res.data.get("pipeline_log") or []
        if not isinstance(logs, list):
            logs = []

        logs.append({
            "step": step,
            "status": status,
            "detail": detail[:500],
            "timestamp": now_iso(),
        })

        sb.table("contracts").update({"pipeline_log": logs}).eq("id", contract_id).execute()
    except Exception as e:
        print(f"Log append error: {e}")


@app.get("/health")
def health():
    return {
        "ok": True,
        "ssu_api": SSU_API_URL,
        "hmc_api": HMC_API_URL,
        "supabase": bool(SUPABASE_URL),
    }


@app.post("/process")
async def process_pipeline(
    file: UploadFile = File(...),
    contract_id: str = Form(...),
    document_type: str = Form("기타문서"),
    file_name: str = Form("document.pdf"),
):
    sb = get_supabase()
    file_bytes = await file.read()

    # ── 1단계: 시작 ──
    if sb:
        sb.table("contracts").update({"status": "ocr_processing"}).eq("id", contract_id).execute()
    append_log(sb, contract_id, "시작", "success", f"파일: {file_name}, 유형: {document_type}, 크기: {len(file_bytes)} bytes")

    # ── 2단계: 숭실대 API 호출 ──
    ssu_result = None
    ocr_text = ""
    append_log(sb, contract_id, "OCR+메타데이터 추출", "processing", f"숭실대 API 호출 중... ({SSU_API_URL})")

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            ssu_files = {"file": (file_name, file_bytes, "application/pdf")}
            ssu_data = {"document_type": document_type, "consolidate": "true"}

            ssu_response = await client.post(
                f"{SSU_API_URL}/api/llm-extract",
                files=ssu_files,
                data=ssu_data,
            )

            if ssu_response.status_code == 200:
                ssu_result = ssu_response.json()
                ocr_text = ssu_result.get("ocr_text", "")
                processing_time = ssu_result.get("processing_time", 0)

                append_log(sb, contract_id, "OCR+메타데이터 추출", "success",
                    f"OCR: {len(ocr_text)}자 추출, 처리시간: {processing_time:.1f}초")

                if sb:
                    sb.table("contracts").update({
                        "ocr_text": ocr_text[:10000],
                        "contract_metadata": ssu_result.get("consolidated_metadata") or ssu_result.get("metadata"),
                        "status": "classifying",
                    }).eq("id", contract_id).execute()
            else:
                error_msg = ssu_response.text[:200]
                append_log(sb, contract_id, "OCR+메타데이터 추출", "failed", f"HTTP {ssu_response.status_code}: {error_msg}")
                if sb:
                    sb.table("contracts").update({"status": "failed"}).eq("id", contract_id).execute()
                raise HTTPException(status_code=500, detail=f"숭실대 API 오류: {error_msg}")

    except httpx.TimeoutException:
        append_log(sb, contract_id, "OCR+메타데이터 추출", "failed", "타임아웃 (600초 초과)")
        if sb:
            sb.table("contracts").update({"status": "failed"}).eq("id", contract_id).execute()
        raise HTTPException(status_code=504, detail="숭실대 API 타임아웃")
    except HTTPException:
        raise
    except Exception as e:
        append_log(sb, contract_id, "OCR+메타데이터 추출", "failed", str(e)[:200])
        if sb:
            sb.table("contracts").update({"status": "failed"}).eq("id", contract_id).execute()
        raise HTTPException(status_code=500, detail=str(e))

    # ── 3단계: HMC API 호출 ──
    hmc_result = None
    append_log(sb, contract_id, "유형분류", "processing", f"HMC API 호출 중... ({HMC_API_URL})")

    if ocr_text:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                hmc_response = await client.post(
                    f"{HMC_API_URL}/api/predict",
                    json={
                        "text": ocr_text,
                        "file_name": file_name,
                        "auto_detect_form": True,
                    },
                )

                if hmc_response.status_code == 200:
                    hmc_result = hmc_response.json()
                    predicted_type = hmc_result.get("predicted_type", "")
                    kogl_type = TYPE_MAP.get(predicted_type)
                    confidence = hmc_result.get("confidence")
                    evidence_sentences = hmc_result.get("evidence_sentences", [])

                    append_log(sb, contract_id, "유형분류", "success",
                        f"결과: {predicted_type} ({kogl_type}), 정확도: {confidence:.4f}, 근거: {len(evidence_sentences)}건")

                    if sb:
                        sb.table("contracts").update({
                            "gongnuri_type": kogl_type,
                            "gongnuri_confidence": confidence,
                            "gongnuri_evidence": "\n".join(e["sentence"] for e in evidence_sentences),
                            "status": "completed",
                        }).eq("id", contract_id).execute()

                        if evidence_sentences:
                            clauses = [{
                                "contract_id": contract_id,
                                "clause_type": "SCOPE",
                                "clause_text": ev["sentence"],
                                "match_score": ev.get("score", 0),
                            } for ev in evidence_sentences]
                            sb.table("contract_clauses").insert(clauses).execute()

                    append_log(sb, contract_id, "완료", "success", f"전체 완료. 유형: {kogl_type}")
                else:
                    append_log(sb, contract_id, "유형분류", "failed", f"HTTP {hmc_response.status_code}: {hmc_response.text[:200]}")
                    if sb:
                        sb.table("contracts").update({"status": "review_required"}).eq("id", contract_id).execute()

        except httpx.TimeoutException:
            append_log(sb, contract_id, "유형분류", "failed", "HMC API 타임아웃 (120초)")
            if sb:
                sb.table("contracts").update({"status": "review_required"}).eq("id", contract_id).execute()
        except Exception as e:
            append_log(sb, contract_id, "유형분류", "failed", str(e)[:200])
            if sb:
                sb.table("contracts").update({"status": "review_required"}).eq("id", contract_id).execute()

    return {
        "ok": True,
        "contract_id": contract_id,
        "ssu_success": ssu_result is not None,
        "hmc_success": hmc_result is not None,
        "kogl_type": TYPE_MAP.get(hmc_result.get("predicted_type", "")) if hmc_result else None,
        "processing_time": ssu_result.get("processing_time", 0) if ssu_result else 0,
    }


@app.post("/process-combined")
async def process_combined(
    rights_check_id: str = Form(...),
    document_type: str = Form("계약서"),
    contract: UploadFile = File(...),
    works: list[UploadFile] = File(default=[]),
):
    sb = get_supabase()
    contract_name = contract.filename or "contract.pdf"
    contract_bytes = await contract.read()
    work_files = [((w.filename or f"work_{i}"), await w.read()) for i, w in enumerate(works)]

    def upd(fields):
        if sb:
            sb.table("rights_checks").update(fields).eq("id", rights_check_id).execute()

    upd({"status": "ocr_processing"})
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            ssu = await _ssu_extract(client, contract_bytes, contract_name, document_type)
            ocr_text = ssu.get("ocr_text", "") or ""
            contract_meta = ssu.get("consolidated_metadata") or ssu.get("metadata")
            works_out = []
            for (wname, wbytes) in work_files:
                try:
                    wssu = await _ssu_extract(client, wbytes, wname, "기타문서")
                    wmeta = wssu.get("consolidated_metadata") or wssu.get("metadata") or {}
                    works_out.append({"work_filename": wname, **map_ssu_to_work_fields(wmeta)})
                except Exception:
                    works_out.append({"work_filename": wname, "_error": "추출 실패"})
            upd({
                "ocr_text": ocr_text[:20000],
                "contract_metadata": {"contract": contract_meta, "works": works_out},
                "status": "predicting",
            })
            hmc_type = None
            try:
                hmc = await _hmc_classify(client, ocr_text, contract_name)
                hmc_type = {
                    "source": "hmc",
                    "predicted_type": hmc.get("predicted_type"),
                    "predicted_display": hmc.get("predicted_display"),
                    "description": hmc.get("predicted_description"),
                    "confidence": hmc.get("confidence"),
                    "probabilities": hmc.get("probabilities"),
                    "evidence_sentences": [
                        {"sentence": e.get("sentence"), "best_type": e.get("best_type"), "score": e.get("score")}
                        for e in (hmc.get("evidence_sentences") or [])
                    ],
                }
            except Exception:
                hmc_type = None
            # 저작물별 신유형 판정(제0유형·AI유형) 병합
            hmc_kogl = None
            if hmc_type and hmc_type.get("predicted_type"):
                hmc_kogl = TYPE_MAP.get(hmc_type["predicted_type"])
            for wrow in works_out:
                verdict = resolve_kogl_type(wrow, hmc_kogl)
                wrow["resolved_type"] = verdict["resolved_type"]
                wrow["ai_type_applied"] = verdict["ai_candidate"]
                wrow["type_reason"] = verdict["reason"]
                wrow["type_low_confidence"] = verdict["low_confidence"]
            upd({"contract_metadata": {"contract": contract_meta, "works": works_out}})
            rights = await _rights_predict(client, ocr_text, contract_name)
            upd({
                "summary": rights.get("summary"),
                "rights_results": rights.get("rights_results"),
                "evidence": rights.get("evidence"),
                "model_info": {**(rights.get("model") or {}), "mode": "combined", "type": hmc_type},
                "status": "completed",
            })
        return {"ok": True, "rights_check_id": rights_check_id, "status": "completed", "works": len(work_files)}
    except Exception as e:
        upd({"status": "failed"})
        return {"ok": False, "rights_check_id": rights_check_id, "error": str(e)[:300]}


@app.post("/process-rights")
async def process_rights(
    rights_check_id: str = Form(...),
    document_type: str = Form("기타문서"),
    file: UploadFile = File(default=None),
    text: str = Form(default=""),
):
    sb = get_supabase()

    def upd(fields):
        if sb:
            sb.table("rights_checks").update(fields).eq("id", rights_check_id).execute()

    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            fname = "text"
            if text and text.strip():
                ocr_text = text.strip()[:20000]
                upd({"ocr_text": ocr_text, "status": "predicting"})
            elif file is not None:
                upd({"status": "ocr_processing"})
                fbytes = await file.read()
                fname = file.filename or "document.pdf"
                ssu = await _ssu_extract(client, fbytes, fname, document_type)
                ocr_text = (ssu.get("ocr_text", "") or "")[:20000]
                upd({
                    "ocr_text": ocr_text,
                    "contract_metadata": ssu.get("consolidated_metadata") or ssu.get("metadata"),
                    "status": "predicting",
                })
            else:
                upd({"status": "failed"})
                return {"ok": False, "error": "file 또는 text 필요"}
            rights = await _rights_predict(client, ocr_text, fname)
            upd({
                "summary": rights.get("summary"),
                "rights_results": rights.get("rights_results"),
                "evidence": rights.get("evidence"),
                "model_info": {**(rights.get("model") or {}), "type": None, "mode": "rights"},
                "status": "completed",
            })
        return {"ok": True, "rights_check_id": rights_check_id, "status": "completed"}
    except Exception as e:
        upd({"status": "failed"})
        return {"ok": False, "rights_check_id": rights_check_id, "error": str(e)[:300]}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "7860"))
    uvicorn.run(app, host="0.0.0.0", port=port)
