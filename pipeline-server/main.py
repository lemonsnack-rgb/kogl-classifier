# -*- coding: utf-8 -*-
"""
KOGL 파이프라인 서버
프론트엔드 → 이 서버 → 숭실대 API (OCR+메타데이터) → HMC API (유형분류) → Supabase DB 저장
"""

import os
import json
from datetime import datetime, timezone
import httpx
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

# 환경변수
SSU_API_URL = os.environ.get("SSU_API_URL", "http://150.230.114.9:5000")
HMC_API_URL = os.environ.get("HMC_API_URL", "https://ilwang-kogl-hmc-server.hf.space")
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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "7860"))
    uvicorn.run(app, host="0.0.0.0", port=port)
