# -*- coding: utf-8 -*-
"""권리추정 전용 FastAPI 서버 (권리 모델만 서빙 — 유형은 별도 HMC API 사용)."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from rights_engine import (
    FinalSchemaRightsInferenceEngine, DEFAULT_MAX_LENGTH, DEFAULT_MAX_EVIDENCE,
)
from schema import AUTHORITY_GROUP_KO, STATUS_KO

# ── 권리추정 모델 ──
RIGHTS_MODEL_PATH = os.environ.get("RIGHTS_MODEL_PATH", "./model/권리추정_260610.pt")
RIGHTS_MODEL_REPO = os.environ.get("RIGHTS_MODEL_REPO")
RIGHTS_MODEL_FILE = os.environ.get("RIGHTS_MODEL_FILE") or Path(RIGHTS_MODEL_PATH).name

RIGHT_ENGINE: Optional[Any] = None
RIGHT_ENGINE_ERROR: Optional[str] = None


def _resolve_path(repo: Optional[str], filename: str, local_path: str) -> Path:
    """repo가 설정되어 있으면 HuggingFace Hub에서 내려받아 그 경로를, 아니면 로컬 경로를 반환."""
    if repo:
        from huggingface_hub import hf_hub_download  # lazy import: 테스트 시 네트워크 불필요
        downloaded = hf_hub_download(repo_id=repo, filename=filename, token=os.environ.get("HF_TOKEN"))
        return Path(downloaded)
    return Path(local_path)


def load_engine(path: Path):
    global RIGHT_ENGINE, RIGHT_ENGINE_ERROR
    RIGHT_ENGINE = FinalSchemaRightsInferenceEngine(path)
    RIGHT_ENGINE_ERROR = None
    return RIGHT_ENGINE


def get_engine():
    if RIGHT_ENGINE is None:
        raise HTTPException(status_code=503, detail="권리 모델이 로드되지 않았습니다.")
    return RIGHT_ENGINE


class PredictOptions(BaseModel):
    max_length: Optional[int] = DEFAULT_MAX_LENGTH
    max_evidence: Optional[int] = DEFAULT_MAX_EVIDENCE
    evidence_threshold: Optional[float] = None
    return_offsets: Optional[bool] = True
    return_evidence_text: Optional[bool] = True
    include_debug: Optional[bool] = False


class PredictRequest(BaseModel):
    document_id: Optional[str] = None
    file_name: Optional[str] = None
    text: str
    options: Optional[PredictOptions] = None


app = FastAPI(title="KOGL 권리추정 API", version="rights-v1")


@app.on_event("startup")
def _startup():
    global RIGHT_ENGINE_ERROR
    try:
        rp = _resolve_path(RIGHTS_MODEL_REPO, RIGHTS_MODEL_FILE, RIGHTS_MODEL_PATH)
        if rp.exists():
            load_engine(rp)
        else:
            RIGHT_ENGINE_ERROR = f"모델 파일 없음: {rp}"
    except Exception as e:  # noqa: BLE001
        RIGHT_ENGINE_ERROR = f"권리 모델 로드 실패: {e}"


@app.get("/api/v1/health")
def health():
    eng = RIGHT_ENGINE
    model_info = None
    if eng is not None:
        model_info = {
            "model_kind": eng.model_kind,
            "base_model": eng.base_model,
            "checkpoint": Path(eng.checkpoint_path).name if getattr(eng, "checkpoint_path", None) else None,
            "evidence_threshold": eng.evidence_threshold,
            "top_k": eng.top_k,
        }
    return {
        "ok": eng is not None,
        "right_loaded": eng is not None,
        "right_error": RIGHT_ENGINE_ERROR,
        "model": model_info,
    }


# 명세서(sample_rights_response.json) evidence 항목 필드 — 이 필드만 노출한다.
EVIDENCE_FIELDS = ("evidence_no", "authority", "authority_ko", "status", "text", "start_char", "end_char", "confidence")


def _build_response(req: PredictRequest, result: Dict[str, Any]) -> Dict[str, Any]:
    summary = result.get("summary", {}) or {}
    rights_results = []
    for r in result.get("results", []):
        status = r.get("status")
        is_unknown = status == "UNKNOWN"
        rights_results.append({
            "group": r.get("group") or AUTHORITY_GROUP_KO.get(r.get("authority"), "기타"),
            "authority": r.get("authority"),
            "authority_ko": r.get("authority_ko"),
            "status": status,
            "display_result": "-" if is_unknown else r.get("display_result", STATUS_KO.get(status, status)),
            "confidence": None if is_unknown else r.get("confidence"),
            "evidence_numbers": [] if is_unknown else r.get("evidence_numbers", []),
            "review_required": bool(str(r.get("safe_result", "")).startswith("REVIEW")),
        })
    # evidence는 명세서 필드로만 정규화(내부 필드 제거) → 타 개발사 연동 시 스펙 그대로 사용 가능
    evidence = [{k: ev.get(k) for k in EVIDENCE_FIELDS} for ev in (result.get("evidence", []) or [])]
    return {
        "ok": True,
        "document_id": req.document_id,
        "file_name": req.file_name,
        "model": {
            "model_kind": result.get("model_kind"),
            "base_model": result.get("model_name"),
            "checkpoint": Path(result.get("checkpoint_path", "")).name,
            "evidence_threshold": result.get("threshold"),
            "top_k": result.get("top_k"),
        },
        "summary": {
            "safe": summary.get("safe", 0),
            "review": summary.get("review", 0),
            "none": summary.get("none", 0),
            "evidence_count": summary.get("evidence", 0),
        },
        "rights_results": rights_results,
        "evidence": evidence,
    }


@app.post("/api/v1/rights/predict")
def predict(req: PredictRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")
    eng = get_engine()
    opts = req.options or PredictOptions()
    result = eng.predict(
        text=text,
        max_length=int(opts.max_length or DEFAULT_MAX_LENGTH),
        max_evidence=int(opts.max_evidence or DEFAULT_MAX_EVIDENCE),
    )
    return _build_response(req, result)
