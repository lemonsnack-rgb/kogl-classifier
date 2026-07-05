# -*- coding: utf-8 -*-
"""권리추정 전용 FastAPI 서버."""
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

RIGHTS_MODEL_PATH = os.environ.get("RIGHTS_MODEL_PATH", "./model/권리추정_260610.pt")

RIGHT_ENGINE: Optional[Any] = None
RIGHT_ENGINE_ERROR: Optional[str] = None


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
    p = Path(RIGHTS_MODEL_PATH)
    if p.exists():
        try:
            load_engine(p)
        except Exception as e:  # noqa: BLE001
            RIGHT_ENGINE_ERROR = str(e)
    else:
        RIGHT_ENGINE_ERROR = f"모델 파일 없음: {p}"


@app.get("/api/v1/health")
def health():
    eng = RIGHT_ENGINE
    return {
        "ok": eng is not None,
        "right_loaded": eng is not None,
        "right_error": RIGHT_ENGINE_ERROR,
        "model": eng.info if eng is not None else None,
    }


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
        "evidence": result.get("evidence", []),
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
