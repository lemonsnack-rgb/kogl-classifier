# -*- coding: utf-8 -*-
"""KOGL 유형·권리 통합 추론 FastAPI 서버 (두 모델 동시 로드)."""
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

# ── 유형추정 모델 ──
TYPE_MODEL_PATH = os.environ.get("TYPE_MODEL_PATH", "./model/Kogl_Type_best_260610.pt")
TYPE_MODEL_REPO = os.environ.get("TYPE_MODEL_REPO")
TYPE_MODEL_FILE = os.environ.get("TYPE_MODEL_FILE") or Path(TYPE_MODEL_PATH).name

RIGHT_ENGINE: Optional[Any] = None
RIGHT_ENGINE_ERROR: Optional[str] = None
TYPE_ENGINE: Optional[Any] = None
TYPE_ENGINE_ERROR: Optional[str] = None

# 유형 근거 태그 → 한글 라벨 (표시용)
TYPE_TAG_KO = {
    "COMMERCIAL_ALLOWED": "상업적 이용: 허용",
    "COMMERCIAL_PROHIBITED": "상업적 이용: 금지",
    "DERIVATIVE_ALLOWED": "변경/2차적저작물: 허용",
    "DERIVATIVE_PROHIBITED": "변경/2차적저작물: 금지",
    "ATTRIBUTION_REQUIRED": "출처표시: 필요",
    "RIGHT_DERIVATIVE_SELECTED": "2차적저작물작성권: 선택",
    "RIGHT_DERIVATIVE_UNSELECTED": "2차적저작물작성권: 미선택",
    "RIGHT_DISTRIBUTION_SELECTED": "배포권: 선택",
    "RIGHT_PUBLIC_TRANSMISSION_SELECTED": "공중송신권: 선택",
}


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


def load_type_engine(path: Path):
    global TYPE_ENGINE, TYPE_ENGINE_ERROR
    from type_engine import TypeAxisGroundedEngine  # lazy: 권리 테스트 시 불필요
    TYPE_ENGINE = TypeAxisGroundedEngine(path)
    TYPE_ENGINE_ERROR = None
    return TYPE_ENGINE


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


app = FastAPI(title="KOGL 유형·권리 통합 추론 API", version="combined-v1")


@app.on_event("startup")
def _startup():
    global RIGHT_ENGINE_ERROR, TYPE_ENGINE_ERROR
    # 권리 모델
    try:
        rp = _resolve_path(RIGHTS_MODEL_REPO, RIGHTS_MODEL_FILE, RIGHTS_MODEL_PATH)
        if rp.exists():
            load_engine(rp)
        else:
            RIGHT_ENGINE_ERROR = f"모델 파일 없음: {rp}"
    except Exception as e:  # noqa: BLE001
        RIGHT_ENGINE_ERROR = f"권리 모델 로드 실패: {e}"
    # 유형 모델
    try:
        tp = _resolve_path(TYPE_MODEL_REPO, TYPE_MODEL_FILE, TYPE_MODEL_PATH)
        if tp.exists():
            load_type_engine(tp)
        else:
            TYPE_ENGINE_ERROR = f"모델 파일 없음: {tp}"
    except Exception as e:  # noqa: BLE001
        TYPE_ENGINE_ERROR = f"유형 모델 로드 실패: {e}"


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
        "type_loaded": TYPE_ENGINE is not None,
        "type_error": TYPE_ENGINE_ERROR,
        "model": model_info,
    }


def _build_type(text: str, max_length: int, max_evidence: int) -> Optional[Dict[str, Any]]:
    if TYPE_ENGINE is None:
        return None
    tr = TYPE_ENGINE.predict(text=text, max_length=max_length, max_evidence=max_evidence)
    evidence = []
    for ev in tr.get("evidence", []) or []:
        evidence.append({
            "evidence_no": ev.get("evidence_no"),
            "axis": ev.get("axis"),
            "axis_ko": next((a["axis_ko"] for a in tr.get("axes", []) if a["axis"] == ev.get("axis")), ev.get("axis")),
            "status": ev.get("status"),
            "status_ko": STATUS_KO.get(ev.get("status"), ev.get("status")),
            "tag": ev.get("tag"),
            "source": "type",
            "text": ev.get("text"),
            "start_char": ev.get("start_char"),
            "end_char": ev.get("end_char"),
            "confidence": ev.get("confidence"),
        })
    return {
        "predicted_type": tr.get("predicted_type"),
        "confidence": tr.get("confidence"),
        "base_model": tr.get("model_name"),
        "axes": tr.get("axes", []),
        "evidence": evidence,
    }


def _build_response(req: PredictRequest, result: Dict[str, Any], type_result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
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
        "text": req.text,
        "type": type_result,
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
    max_length = int(opts.max_length or DEFAULT_MAX_LENGTH)
    max_evidence = int(opts.max_evidence or DEFAULT_MAX_EVIDENCE)
    result = eng.predict(text=text, max_length=max_length, max_evidence=max_evidence)
    type_result = _build_type(text, max_length, max_evidence)
    return _build_response(req, result, type_result)
