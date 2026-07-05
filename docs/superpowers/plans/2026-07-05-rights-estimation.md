# 권리추정(Rights Estimation) 기능 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 "검사하기" 기능을 그대로 둔 채, 독립된 "권리추정" 메뉴를 추가해 PDF → SSU(OCR+메타데이터) → 신규 권리 모델 → 결과 저장/표시 흐름을 제공한다.

**Architecture:** Next.js(App Router) 프론트에 신규 라우트/어댑터/서버라우트를 추가하고, 전달 패키지의 권리 추론 엔진만 추출한 독립 FastAPI 서버(`rights-server/`)를 두어 `/api/v1/rights/predict`로 서빙한다. 결과는 신규 Supabase 테이블 `rights_checks`에 JSONB로 저장한다.

**Tech Stack:** Next.js 14 / TypeScript / Supabase(Postgres+RLS+Storage) / Python FastAPI + PyTorch + transformers(klue/roberta-base).

## Global Constraints

- **기존 기능 무영향 (최우선):** 기존 라우트/API/어댑터/타입/테이블/마이그레이션을 수정하지 않는다. 허용되는 기존 파일 수정은 오직 (a) `src/components/layout/Sidebar.tsx`에 메뉴 1줄 추가, (b) `src/lib/api/config.ts`에 신규 getter 추가, (c) `src/lib/api/index.ts`에 신규 re-export 추가 — 모두 기존 항목은 유지하고 추가만 한다.
- 신규 기능은 환경변수 `NEXT_PUBLIC_RIGHTS_API_URL` 미설정 시 Mock으로 동작해야 한다(기존 배포 무영향).
- 권리 API 요청/응답 스키마는 명세서와 1:1로 일치시킨다(`predict_rights_request_sample.json` / `sample_rights_response.json`).
- 권리 서버 기본 파라미터: `evidence_threshold=0.70`, `top_k=5`, `max_length=512`, `max_evidence=20`.
- 모델 경로 기본값: `RIGHTS_MODEL_PATH=./model/권리추정_260610.pt`. 모델 `.pt` 파일은 커밋하지 않는다.
- 프론트엔드는 별도 JS 테스트 프레임워크를 도입하지 않는다(현재 무설치). 프론트 검증은 `npx tsc --noEmit`(타입) + `npm run build`(빌드) + Mock 런타임 확인으로 한다. Python 서버는 pytest로 TDD 한다.
- Supabase 정책 패턴은 기존 `001_initial_schema.sql`의 `contracts`와 동일하게 맞춘다(본인 CRUD + 관리자 SELECT).
- 커밋 co-author 트레일러: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 모든 명령은 작업 루트 `kogl-classifier/`에서 실행. Python 명령은 `kogl-classifier/rights-server/`에서 실행.

---

## File Structure

**신규 (Python 백엔드) — `rights-server/`**
- `rights-server/rights_engine.py` — 권리 추론 엔진(전달 소스에서 추출), 순수 로직
- `rights-server/schema.py` — 기본 스키마/상수(`DEFAULT_SCHEMA`, `AUTHORITY_GROUP_KO`, `STATUS_KO`, 근거 필터)
- `rights-server/app.py` — FastAPI 앱(`/api/v1/health`, `/api/v1/rights/predict`)
- `rights-server/requirements.txt`
- `rights-server/README.md`
- `rights-server/tests/test_schema.py` — 순수 함수 단위 테스트(모델 불필요)
- `rights-server/tests/test_api.py` — 엔진을 가짜로 주입해 API 계약 테스트(모델 불필요)
- `rights-server/model/.gitkeep` — 모델 배치 폴더(`.pt`는 gitignore)

**신규 (프론트) — `src/`**
- `src/lib/api/rights-types.ts` — 요청/응답 타입
- `src/lib/api/rights.ts` — 어댑터(`predictRights`, `checkRightsHealth`) + Mock
- `src/app/api/rights/process/route.ts` — 파이프라인 서버 라우트(SSU→권리→저장)
- `src/app/rights/page.tsx` — 업로드 + 기록 목록
- `src/app/rights/[id]/page.tsx` — 결과 상세
- `src/app/rights/RightsResultView.tsx` — 결과 표시 컴포넌트(그룹 테이블+근거)

**수정 (추가만) — `src/`**
- `src/lib/api/config.ts` — `RIGHTS_API_BASE_URL`, `useMockRights`
- `src/lib/api/index.ts` — 신규 re-export
- `src/components/layout/Sidebar.tsx` — `topMenuItems`에 1줄

**신규 (DB)**
- `supabase/migrations/002_rights_checks.sql`

---

## Task 1: DB 마이그레이션 — rights_checks 테이블

**Files:**
- Create: `supabase/migrations/002_rights_checks.sql`

**Interfaces:**
- Produces: 테이블 `rights_checks(id, user_id, file_name, file_url, ocr_text, contract_metadata jsonb, summary jsonb, rights_results jsonb, evidence jsonb, model_info jsonb, status, created_at, updated_at)` + RLS 정책. 이후 Task 7/8/9가 이 스키마에 의존.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- =============================================
-- 권리추정 기록 테이블 (독립 기능, 기존 스키마 무변경)
-- =============================================
CREATE TABLE rights_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  ocr_text TEXT,
  contract_metadata JSONB,
  summary JSONB,
  rights_results JSONB,
  evidence JSONB,
  model_info JSONB,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'ocr_processing', 'predicting', 'completed', 'failed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rights_checks_user_id ON rights_checks(user_id);
CREATE INDEX idx_rights_checks_created_at ON rights_checks(created_at DESC);

ALTER TABLE rights_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rights_checks"
  ON rights_checks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all rights_checks"
  ON rights_checks FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Users can insert own rights_checks"
  ON rights_checks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own rights_checks"
  ON rights_checks FOR UPDATE USING (user_id = auth.uid());

CREATE TRIGGER rights_checks_updated_at
  BEFORE UPDATE ON rights_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: 검증 — SQL 문법 확인**

`update_updated_at()` 함수와 `profiles` 테이블은 `001_initial_schema.sql`에 이미 존재하므로 이 마이그레이션은 001 이후 적용되어야 함을 확인한다(파일명 002 접두사로 순서 보장). 실제 적용은 Supabase 프로젝트에서 수동/CI로 수행.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_rights_checks.sql
git commit -m "feat(db): rights_checks 테이블 마이그레이션 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: rights-server — 스키마/상수 모듈 + 순수함수 테스트

전달 소스 `저작권_권리추정_모델전달_API패키지_v1.1/sample/kogl_finalschema_inference_web_gui_v2.py`의 상수/헬퍼를 추출한다. 원본은 프로젝트 루트 밖 `../저작권_권리추정_모델전달_API패키지_v1.1/`에 있음.

**Files:**
- Create: `rights-server/schema.py`
- Test: `rights-server/tests/test_schema.py`

**Interfaces:**
- Produces: `DEFAULT_SCHEMA: dict`, `AUTHORITY_GROUP_KO: dict`, `STATUS_KO: dict`, `AUTHORITY_GROUP_ORDER: list`, 헬퍼 `_compact_text`, `_contains_any`, `_line_bounds`, `_sentence_or_line_bounds`, `_is_checkbox_evidence_segment`, `_is_title_or_purpose_fragment`, `_candidate_is_meaningful`, `schema_items`. Task 3(엔진)이 import.

- [ ] **Step 1: 실패 테스트 작성**

`rights-server/tests/test_schema.py`:
```python
from schema import (
    DEFAULT_SCHEMA, AUTHORITY_GROUP_KO, STATUS_KO, schema_items,
    _compact_text, _contains_any, _is_checkbox_evidence_segment,
)

def test_default_schema_has_core_rights():
    assert "RIGHT_REPRODUCTION" in DEFAULT_SCHEMA
    assert DEFAULT_SCHEMA["RIGHT_REPRODUCTION"]["ko"] == "복제권"
    assert "UNKNOWN" in DEFAULT_SCHEMA["RIGHT_REPRODUCTION"]["statuses"]

def test_group_mapping():
    assert AUTHORITY_GROUP_KO["RIGHT_REPRODUCTION"] == "저작재산권"
    assert AUTHORITY_GROUP_KO["COMMERCIAL_USE"] == "이용조건"

def test_status_ko():
    assert STATUS_KO["ALLOW"] == "허용"
    assert STATUS_KO["PROHIBIT"] == "금지"

def test_schema_items_returns_keys():
    assert schema_items(DEFAULT_SCHEMA) == list(DEFAULT_SCHEMA.keys())

def test_compact_text_collapses_whitespace():
    assert _compact_text("가  나\n다") == "가 나 다"

def test_checkbox_evidence_detected():
    assert _is_checkbox_evidence_segment("☑ 복제권", "RIGHT_REPRODUCTION") is True
    assert _is_checkbox_evidence_segment("복제권", "RIGHT_REPRODUCTION") is False
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd rights-server && python -m pytest tests/test_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'schema'`

- [ ] **Step 3: schema.py 작성**

전달 소스의 다음 부분을 그대로 옮긴다(라인 56–228 영역): `STATUS_KO`, `AUTHORITY_GROUP_KO`, `DEFAULT_SCHEMA`, `AUTHORITY_GROUP_ORDER`, `CHECKBOX_MARKERS`, `RIGHT_CUE_BY_ITEM`, `POSITIVE_CUES`, `NEGATIVE_CUES`, `TITLE_OR_PURPOSE_CUES`, 그리고 함수 `_compact_text`, `_contains_any`, `_line_bounds`, `_sentence_or_line_bounds`, `_is_checkbox_evidence_segment`, `_is_title_or_purpose_fragment`, `_candidate_is_meaningful`, `schema_items`. (유형 관련 `CLS_LABEL_MAP`, `DEFAULT_TYPE_TOKEN_LABELS`는 제외.)

파일 상단:
```python
# -*- coding: utf-8 -*-
"""권리추정 스키마/상수/근거필터 — 전달 패키지 소스에서 추출."""
from __future__ import annotations
from typing import Any, Dict, List, Tuple
```
이어서 위 상수/함수들을 원본과 동일하게 붙여넣는다. (원본 파일: `../저작권_권리추정_모델전달_API패키지_v1.1/sample/kogl_finalschema_inference_web_gui_v2.py` 라인 72–228.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd rights-server && python -m pytest tests/test_schema.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add rights-server/schema.py rights-server/tests/test_schema.py
git commit -m "feat(rights-server): 권리 스키마/상수/근거필터 모듈 추출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: rights-server — 추론 엔진 모듈

**Files:**
- Create: `rights-server/rights_engine.py`

**Interfaces:**
- Consumes: `schema.py`의 상수/헬퍼.
- Produces: 클래스 `FinalSchemaGroundedModel(nn.Module)`, `FinalSchemaRightsInferenceEngine`. 후자는 `__init__(self, checkpoint_path: Path)`, `predict(self, text: str, max_length: int, max_evidence: int) -> Dict[str, Any]`, 속성 `.info`, `.base_model`, `.evidence_threshold`, `.top_k`, `.model_kind`, `.checkpoint_path`. `predict` 반환 dict 키: `summary, decision_confidence, overall_confidence, results, evidence, model_name, checkpoint_path, model_kind, threshold, top_k`. Task 4(app)가 사용.

- [ ] **Step 1: rights_engine.py 작성**

전달 소스에서 다음을 추출: `safe_torch_load`(라인 240–245), `FinalSchemaGroundedModel`(401–445), `FinalSchemaRightsInferenceEngine`(448–705). `schema.py`에서 필요한 심볼을 import.

파일 상단:
```python
# -*- coding: utf-8 -*-
"""권리 추론 엔진 — 전달 패키지 소스에서 추출."""
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import torch
import torch.nn as nn
from transformers import AutoModel, AutoTokenizer

from schema import (
    DEFAULT_SCHEMA, AUTHORITY_GROUP_KO, STATUS_KO, schema_items,
    _is_checkbox_evidence_segment, _sentence_or_line_bounds, _candidate_is_meaningful,
)

DEFAULT_MAX_LENGTH = 512
DEFAULT_MAX_EVIDENCE = 20
DEFAULT_BASE_MODEL = "klue/roberta-base"
DEFAULT_EVIDENCE_THRESHOLD = 0.70
DEFAULT_TOP_K = 5
```
이어서 `safe_torch_load`, `FinalSchemaGroundedModel`, `FinalSchemaRightsInferenceEngine`를 원본과 동일하게 붙여넣는다(원본 라인 240–245, 401–705). 원본에서 사용하는 모듈 전역(`DEFAULT_*`)은 위에 정의된 것을 사용.

- [ ] **Step 2: import 검증 (모델 없이 로드만)**

Run: `cd rights-server && python -c "import rights_engine; print('ok', rights_engine.FinalSchemaRightsInferenceEngine.__name__)"`
Expected: `ok FinalSchemaRightsInferenceEngine` (torch/transformers 설치 필요 — Task 5의 requirements 선설치 가능)

- [ ] **Step 3: Commit**

```bash
git add rights-server/rights_engine.py
git commit -m "feat(rights-server): 권리 추론 엔진 모듈 추출

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: rights-server — FastAPI 앱 + API 계약 테스트

**Files:**
- Create: `rights-server/app.py`
- Test: `rights-server/tests/test_api.py`

**Interfaces:**
- Consumes: `rights_engine.FinalSchemaRightsInferenceEngine`.
- Produces: FastAPI `app`. `GET /api/v1/health`, `POST /api/v1/rights/predict`. 요청 Pydantic `PredictRequest{ document_id?, file_name?, text, options?: PredictOptions }`. 응답은 `sample_rights_response.json` 형태. 전역 엔진 접근 함수 `get_engine()`, `load_engine(path)`.

- [ ] **Step 1: 실패 테스트 작성 (가짜 엔진 주입, 모델 불필요)**

`rights-server/tests/test_api.py`:
```python
from fastapi.testclient import TestClient
import app as app_module

class FakeEngine:
    info = {"kind": "authority_finalschema_multilabel_grounded_v4",
            "base": "klue/roberta-base", "threshold": 0.7, "top_k": 5,
            "device": "cpu", "path": "fake.pt"}
    base_model = "klue/roberta-base"
    model_kind = "authority_finalschema_multilabel_grounded_v4"
    checkpoint_path = "fake.pt"
    evidence_threshold = 0.7
    top_k = 5
    def predict(self, text, max_length, max_evidence):
        return {
            "summary": {"safe": 1, "review": 0, "none": 0, "evidence": 1},
            "results": [{
                "authority": "RIGHT_REPRODUCTION", "authority_ko": "복제권",
                "group": "저작재산권", "status": "ALLOW", "display_result": "허용",
                "confidence": 0.98, "evidence_numbers": [1], "review_reason": "",
                "safe_result": "ALLOW",
            }],
            "evidence": [{"evidence_no": 1, "authority": "RIGHT_REPRODUCTION",
                          "authority_ko": "복제권", "status": "ALLOW", "text": "☑ 복제권",
                          "start_char": 0, "end_char": 5, "confidence": 0.93}],
            "model_name": "klue/roberta-base", "checkpoint_path": "fake.pt",
            "model_kind": "authority_finalschema_multilabel_grounded_v4",
            "threshold": 0.7, "top_k": 5,
        }

def setup_module(_):
    app_module.RIGHT_ENGINE = FakeEngine()

def test_health_ok():
    c = TestClient(app_module.app)
    r = c.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["right_loaded"] is True

def test_predict_returns_rights_schema():
    c = TestClient(app_module.app)
    r = c.post("/api/v1/rights/predict", json={
        "document_id": "DOC-1", "file_name": "a.txt", "text": "☑ 복제권",
        "options": {"max_length": 512, "max_evidence": 20},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["document_id"] == "DOC-1"
    assert body["summary"]["safe"] == 1
    assert body["rights_results"][0]["authority_ko"] == "복제권"
    assert body["rights_results"][0]["display_result"] == "허용"
    assert body["evidence"][0]["evidence_no"] == 1

def test_predict_empty_text_400():
    c = TestClient(app_module.app)
    r = c.post("/api/v1/rights/predict", json={"text": "  "})
    assert r.status_code == 400
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd rights-server && python -m pytest tests/test_api.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: app.py 작성**

```python
# -*- coding: utf-8 -*-
"""권리추정 전용 FastAPI 서버."""
from __future__ import annotations
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

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


def _build_response(req: PredictRequest, result: Dict[str, Any], eng) -> Dict[str, Any]:
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
    return _build_response(req, result, eng)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd rights-server && python -m pytest tests/test_api.py -v`
Expected: PASS (3 passed). 참고: `_build_response`는 엔진 `results`의 `safe_result`로 `review_required`를 판정하고, UNKNOWN을 `-`/`null`/`[]`로 정규화한다.

- [ ] **Step 5: Commit**

```bash
git add rights-server/app.py rights-server/tests/test_api.py
git commit -m "feat(rights-server): FastAPI 앱 + API 계약 테스트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: rights-server — requirements/README/gitignore + 실제 모델 스모크

**Files:**
- Create: `rights-server/requirements.txt`, `rights-server/README.md`, `rights-server/model/.gitkeep`
- Create: `rights-server/.gitignore`
- Modify: (없음)

**Interfaces:**
- Produces: 실행 가능한 서버 패키지. 이후 프론트가 `NEXT_PUBLIC_RIGHTS_API_URL`로 연동.

- [ ] **Step 1: requirements.txt 작성**

```
fastapi>=0.110
uvicorn[standard]>=0.29
pydantic>=2.5
torch>=2.1
transformers>=4.38
pymupdf>=1.23
httpx>=0.27
pytest>=8.0
```

- [ ] **Step 2: .gitignore 작성**

```
model/*.pt
__pycache__/
*.pyc
.venv/
```

- [ ] **Step 3: model/.gitkeep 생성 (빈 파일) 및 README 작성**

`rights-server/README.md`:
````markdown
# 권리추정 API 서버

전달 패키지의 권리추정 모델을 서빙하는 독립 FastAPI 서버.

## 설치
```
cd rights-server
python -m venv .venv && . .venv/Scripts/activate   # Windows
pip install -r requirements.txt
```

## 모델 배치
`model/권리추정_260610.pt` 위치에 전달받은 권리 모델을 둔다.
경로 변경 시 `RIGHTS_MODEL_PATH` 환경변수 사용.

## 실행
```
set RIGHTS_MODEL_PATH=./model/권리추정_260610.pt   # Windows
uvicorn app:app --host 0.0.0.0 --port 8080
```

## 엔드포인트
- `GET /api/v1/health`
- `POST /api/v1/rights/predict` — body: `{ text, file_name?, document_id?, options? }`

## 테스트
```
python -m pytest -v
```
````

- [ ] **Step 4: 실제 모델 스모크 테스트 (모델 있을 때만)**

전달 모델을 `model/권리추정_260610.pt`로 복사 후:
```bash
cd rights-server && pip install -r requirements.txt
uvicorn app:app --port 8080 &
curl -s http://127.0.0.1:8080/api/v1/health
curl -s -X POST http://127.0.0.1:8080/api/v1/rights/predict -H "Content-Type: application/json" \
  -d "@../저작권_권리추정_모델전달_API패키지_v1.1/Doc/predict_rights_request_sample.json"
```
Expected: health `right_loaded:true`; predict 응답이 `rights_results[]`+`evidence[]`+`summary` 포함. (모델/네트워크 미가용 시 이 스텝은 건너뛰고 Mock으로 진행 — Global Constraints 참조.)

- [ ] **Step 5: Commit**

```bash
git add rights-server/requirements.txt rights-server/README.md rights-server/model/.gitkeep rights-server/.gitignore
git commit -m "chore(rights-server): requirements/README/gitignore 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 프론트 타입 정의 — rights-types.ts

**Files:**
- Create: `src/lib/api/rights-types.ts`

**Interfaces:**
- Produces: `RightsPredictRequest`, `RightsPredictResponse`, `RightsResultItem`, `RightsEvidenceItem`, `RightsSummary`, `RightsModelInfo`, `RightsStatus`, `RightsCheckStatus`. Task 5(rights.ts), 7(route), 8/9(pages)가 import.

- [ ] **Step 1: 파일 작성**

```typescript
// 권리추정 API 타입 (rights-server /api/v1/rights/predict 스키마 1:1)

export type RightsStatus =
  | "ALLOW" | "PROHIBIT" | "UNKNOWN"
  | "KOREA" | "WORLDWIDE" | "LIMITED" | "UNRESTRICTED"
  | "PERPETUAL" | "FIXED" | "UNSPECIFIED"
  | "ROYALTY" | "LUMP_SUM" | "FREE"

export type RightsCheckStatus =
  | "uploaded" | "ocr_processing" | "predicting" | "completed" | "failed"

export interface RightsSummary {
  safe: number
  review: number
  none: number
  evidence_count: number
}

export interface RightsModelInfo {
  model_kind: string | null
  base_model: string | null
  checkpoint: string | null
  evidence_threshold: number | null
  top_k: number | null
}

export interface RightsResultItem {
  group: string
  authority: string
  authority_ko: string
  status: RightsStatus
  display_result: string
  confidence: number | null
  evidence_numbers: number[]
  review_required: boolean
}

export interface RightsEvidenceItem {
  evidence_no: number
  authority: string
  authority_ko: string
  status: RightsStatus
  text: string
  start_char: number
  end_char: number
  confidence: number
}

export interface RightsPredictRequest {
  document_id?: string
  file_name?: string
  text: string
  options?: {
    max_length?: number
    max_evidence?: number
    evidence_threshold?: number
    return_offsets?: boolean
    return_evidence_text?: boolean
    include_debug?: boolean
  }
}

export interface RightsPredictResponse {
  ok: boolean
  document_id: string | null
  file_name: string | null
  model: RightsModelInfo
  summary: RightsSummary
  rights_results: RightsResultItem[]
  evidence: RightsEvidenceItem[]
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음(또는 신규 파일 관련 에러 없음)

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/rights-types.ts
git commit -m "feat(api): 권리추정 응답 타입 정의

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 프론트 어댑터 + Mock + 설정/재export

**Files:**
- Create: `src/lib/api/rights.ts`
- Modify: `src/lib/api/config.ts` (추가만), `src/lib/api/index.ts` (추가만)

**Interfaces:**
- Consumes: `rights-types.ts`, `config.ts`.
- Produces: `predictRights(text: string, fileName?: string): Promise<RightsPredictResponse>`, `checkRightsHealth(): Promise<{ ok: boolean; right_loaded: boolean }>`, `getMockRightsResponse(text, fileName)`. `config.ts`에 `API_CONFIG.RIGHTS_API_BASE_URL`, `API_CONFIG.useMockRights`. Task 8/9가 사용.

- [ ] **Step 1: config.ts에 항목 추가 (기존 유지)**

`src/lib/api/config.ts`의 `API_CONFIG` 객체 안, `HMC_API_BASE_URL` 줄 아래에 추가:
```typescript
  // 권리추정 API (신규, 미설정 시 Mock)
  RIGHTS_API_BASE_URL: process.env.NEXT_PUBLIC_RIGHTS_API_URL || "",
```
그리고 getter 그룹에 추가:
```typescript
  get useMockRights(): boolean {
    return !this.RIGHTS_API_BASE_URL
  },
```
(기존 `useMock`/`useMockSSU`/`useMockHMC` 및 기타 항목은 그대로 둔다.)

- [ ] **Step 2: rights.ts 작성**

```typescript
// 권리추정 어댑터 — rights-server /api/v1/rights/predict
import { API_CONFIG } from "./config"
import type { RightsPredictRequest, RightsPredictResponse } from "./rights-types"

export async function predictRights(
  text: string,
  fileName?: string,
): Promise<RightsPredictResponse> {
  if (API_CONFIG.useMockRights) {
    return getMockRightsResponse(text, fileName)
  }
  const request: RightsPredictRequest = {
    file_name: fileName || "",
    text,
    options: {
      max_length: 512,
      max_evidence: 20,
      evidence_threshold: 0.7,
      return_offsets: true,
      return_evidence_text: true,
      include_debug: false,
    },
  }
  const res = await fetch(`${API_CONFIG.RIGHTS_API_BASE_URL}/api/v1/rights/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `권리추정 API 오류: ${res.status}`)
  }
  return res.json()
}

export async function checkRightsHealth(): Promise<{ ok: boolean; right_loaded: boolean }> {
  if (API_CONFIG.useMockRights) {
    return { ok: true, right_loaded: true }
  }
  const res = await fetch(`${API_CONFIG.RIGHTS_API_BASE_URL}/api/v1/health`)
  if (!res.ok) throw new Error(`권리 Health 확인 실패: ${res.status}`)
  return res.json()
}

export function getMockRightsResponse(
  text: string,
  fileName?: string,
): RightsPredictResponse {
  const has = (kw: string) => text.includes(kw)
  return {
    ok: true,
    document_id: null,
    file_name: fileName || "mock_contract.txt",
    model: {
      model_kind: "authority_finalschema_multilabel_grounded_v4",
      base_model: "klue/roberta-base",
      checkpoint: "권리추정_260610.pt",
      evidence_threshold: 0.7,
      top_k: 5,
    },
    summary: { safe: 3, review: 1, none: 1, evidence_count: 3 },
    rights_results: [
      { group: "저작재산권", authority: "RIGHT_REPRODUCTION", authority_ko: "복제권",
        status: "ALLOW", display_result: "허용", confidence: 0.98,
        evidence_numbers: [1], review_required: false },
      { group: "저작재산권", authority: "RIGHT_EXHIBITION", authority_ko: "전시권",
        status: has("전시") ? "PROHIBIT" : "UNKNOWN",
        display_result: has("전시") ? "금지" : "-",
        confidence: has("전시") ? 0.95 : null,
        evidence_numbers: has("전시") ? [2] : [], review_required: false },
      { group: "이용조건", authority: "COMMERCIAL_USE", authority_ko: "상업적 이용",
        status: "ALLOW", display_result: "허용", confidence: 0.9,
        evidence_numbers: [3], review_required: false },
      { group: "계약성격", authority: "EXCLUSIVITY", authority_ko: "독점성",
        status: "UNKNOWN", display_result: "-", confidence: null,
        evidence_numbers: [], review_required: false },
      { group: "이용범위", authority: "TERRITORY_SCOPE", authority_ko: "이용지역",
        status: "UNKNOWN", display_result: "-", confidence: null,
        evidence_numbers: [], review_required: true },
    ],
    evidence: [
      { evidence_no: 1, authority: "RIGHT_REPRODUCTION", authority_ko: "복제권",
        status: "ALLOW", text: "(Mock) ☑ 복제권", start_char: 0, end_char: 10, confidence: 0.93 },
      { evidence_no: 2, authority: "RIGHT_EXHIBITION", authority_ko: "전시권",
        status: "PROHIBIT", text: "(Mock) □ 전시권", start_char: 12, end_char: 22, confidence: 0.91 },
      { evidence_no: 3, authority: "COMMERCIAL_USE", authority_ko: "상업적 이용",
        status: "ALLOW", text: "(Mock) 유상 사업에 이용할 수 있다.", start_char: 24, end_char: 44, confidence: 0.9 },
    ],
  }
}
```

- [ ] **Step 3: index.ts에 re-export 추가 (기존 유지)**

`src/lib/api/index.ts` 하단에 추가:
```typescript
// 권리추정 API (신규)
export { predictRights, checkRightsHealth, getMockRightsResponse } from "./rights"
export type {
  RightsPredictRequest, RightsPredictResponse, RightsResultItem,
  RightsEvidenceItem, RightsSummary, RightsModelInfo, RightsStatus, RightsCheckStatus,
} from "./rights-types"
```

- [ ] **Step 4: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/rights.ts src/lib/api/config.ts src/lib/api/index.ts
git commit -m "feat(api): 권리추정 어댑터+Mock, config/index 신규 항목 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 파이프라인 서버 라우트 — /api/rights/process

**Files:**
- Create: `src/app/api/rights/process/route.ts`

**Interfaces:**
- Consumes: `predictRights`(from `@/lib/api/rights`), Supabase service client, SSU `/api/llm-extract`.
- Produces: `POST` 핸들러. 입력 body `{ rightsCheckId, fileUrl, fileName, documentType? }`. `rights_checks` 행을 단계별 업데이트, 최종 `{ success, rightsCheckId, status }` 반환. Task 9(page)가 호출.

- [ ] **Step 1: route.ts 작성 (기존 pipeline/process 패턴 차용, 별도 파일)**

```typescript
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { predictRights } from "@/lib/api/rights"

const SSU_API_URL = process.env.NEXT_PUBLIC_SSU_API_URL || ""
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rightsCheckId, fileUrl, fileName, documentType } = body
    if (!rightsCheckId) {
      return NextResponse.json({ error: "rightsCheckId 필요" }, { status: 400 })
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await supabase.from("rights_checks").update({ status: "ocr_processing" }).eq("id", rightsCheckId)

    // 1) 파일 다운로드
    if (!fileUrl || fileUrl.startsWith("/demo")) {
      await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
      return NextResponse.json({ error: "유효한 파일 URL이 없습니다." }, { status: 400 })
    }
    const storagePath = fileUrl.replace(/^.*\/storage\/v1\/object\/public\//, "")
    const [bucket, ...rest] = storagePath.split("/")
    const filePath = rest.join("/")
    let fileBuffer: Buffer
    const { data: fileData, error: dlErr } = await supabase.storage.from(bucket).download(filePath)
    if (dlErr || !fileData) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${storagePath}`)
      if (!res.ok) {
        await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
        return NextResponse.json({ error: "파일 다운로드 실패" }, { status: 500 })
      }
      fileBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      fileBuffer = Buffer.from(await fileData.arrayBuffer())
    }

    // 2) SSU OCR + 메타데이터
    let ocrText = ""
    if (SSU_API_URL) {
      const fd = new FormData()
      fd.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName || "document.pdf")
      fd.append("document_type", documentType || "기타문서")
      fd.append("consolidate", "true")
      const ssuRes = await fetch(`${SSU_API_URL}/api/llm-extract`, { method: "POST", body: fd })
      if (!ssuRes.ok) {
        await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
        return NextResponse.json({ error: `OCR 실패: ${ssuRes.status}` }, { status: 500 })
      }
      const ssu = await ssuRes.json() as Record<string, unknown>
      ocrText = (ssu.ocr_text as string) || ""
      await supabase.from("rights_checks").update({
        ocr_text: ocrText.slice(0, 20000),
        contract_metadata: ssu.consolidated_metadata || ssu.metadata || null,
        status: "predicting",
      }).eq("id", rightsCheckId)
    } else {
      // SSU 미설정 시 Mock 텍스트로 진행 (개발용)
      ocrText = "콘텐츠 저작재산권 양도계약서\n☑ 복제권, □ 전시권\n유상 사업에 이용할 수 있다."
      await supabase.from("rights_checks").update({ ocr_text: ocrText, status: "predicting" }).eq("id", rightsCheckId)
    }

    // 3) 권리추정
    const rights = await predictRights(ocrText, fileName)
    await supabase.from("rights_checks").update({
      summary: rights.summary,
      rights_results: rights.rights_results,
      evidence: rights.evidence,
      model_info: rights.model,
      status: "completed",
    }).eq("id", rightsCheckId)

    return NextResponse.json({ success: true, rightsCheckId, status: "completed" })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "권리추정 처리 중 오류",
    }, { status: 500 })
  }
}
```

- [ ] **Step 2: 타입/빌드 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/app/api/rights/process/route.ts
git commit -m "feat(api): 권리추정 파이프라인 라우트(SSU→권리→저장)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 결과 표시 컴포넌트 — RightsResultView

**Files:**
- Create: `src/app/rights/RightsResultView.tsx`

**Interfaces:**
- Consumes: `RightsPredictResponse`, `RightsResultItem`, `RightsEvidenceItem` from `@/lib/api/rights-types`.
- Produces: `export default function RightsResultView({ data }: { data: RightsPredictResponse })`. Task 10이 사용.

- [ ] **Step 1: 컴포넌트 작성 (그룹 테이블 + 근거 목록 + 요약)**

```tsx
"use client"

import type {
  RightsPredictResponse, RightsResultItem, RightsEvidenceItem, RightsStatus,
} from "@/lib/api/rights-types"

const GROUP_ORDER = ["저작재산권", "이용조건", "계약성격", "이용범위", "대가조건", "기타"]

function statusChip(item: RightsResultItem) {
  if (item.review_required) return { label: "확인필요", cls: "bg-amber-100 text-amber-800" }
  const map: Partial<Record<RightsStatus, { label: string; cls: string }>> = {
    ALLOW: { label: item.display_result, cls: "bg-green-100 text-green-700" },
    PROHIBIT: { label: item.display_result, cls: "bg-red-100 text-red-700" },
    UNKNOWN: { label: "-", cls: "bg-gray-100 text-gray-400" },
  }
  return map[item.status] || { label: item.display_result || "-", cls: "bg-green-100 text-green-700" }
}

export default function RightsResultView({ data }: { data: RightsPredictResponse }) {
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    rows: data.rights_results.filter((r) => r.group === g),
  })).filter((x) => x.rows.length > 0)

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="flex gap-3 flex-wrap">
        <SummaryPill label="허용/확정" value={data.summary.safe} color="#059669" />
        <SummaryPill label="확인필요" value={data.summary.review} color="#D97706" />
        <SummaryPill label="없음" value={data.summary.none} color="#6B7280" />
        <SummaryPill label="근거" value={data.summary.evidence_count} color="#2563EB" />
      </div>

      {/* 권리 그룹 테이블 */}
      {grouped.map(({ group, rows }) => (
        <div key={group} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <span className="text-sm font-bold text-gray-700">{group}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left px-4 py-2 w-[180px]">권리</th>
                <th className="text-left px-4 py-2 w-[110px]">판정</th>
                <th className="text-left px-4 py-2 w-[90px]">신뢰도</th>
                <th className="text-left px-4 py-2">근거번호</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chip = statusChip(r)
                return (
                  <tr key={r.authority} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-900">{r.authority_ko}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${chip.cls}`}>
                        {chip.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-gray-600">
                      {r.confidence == null ? "-" : `${(r.confidence * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {r.evidence_numbers.length ? r.evidence_numbers.join(", ") : "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* 근거 목록 */}
      {data.evidence.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">근거 목록</h3>
          <ol className="space-y-2">
            {data.evidence.map((ev: RightsEvidenceItem) => (
              <li key={ev.evidence_no} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                  {ev.evidence_no}
                </span>
                <div>
                  <span className="text-gray-500 text-xs mr-2">{ev.authority_ko}</span>
                  <span className="text-gray-900">{ev.text}</span>
                  <span className="text-gray-400 text-xs ml-2">({(ev.confidence * 100).toFixed(0)}%)</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ backgroundColor: color + "18", color }}>
      {label} <span className="tabular-nums font-bold">{value}</span>
    </span>
  )
}
```

- [ ] **Step 2: 타입 검증**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/app/rights/RightsResultView.tsx
git commit -m "feat(rights): 권리 결과 표시 컴포넌트

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: 페이지 — /rights (업로드 + 기록 목록) 및 /rights/[id] (상세)

**Files:**
- Create: `src/app/rights/page.tsx`, `src/app/rights/[id]/page.tsx`

**Interfaces:**
- Consumes: Supabase client(`@/lib/supabase/client`), `AppLayout`, `RightsResultView`, `DOCUMENT_TYPES`(from `@/lib/api`), `rights_checks` 테이블, `/api/rights/process`.
- Produces: 라우트 `/rights`, `/rights/[id]`.

- [ ] **Step 1: /rights/page.tsx 작성 (업로드 + 실행 + 목록)**

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { DOCUMENT_TYPES } from "@/lib/api"
import type { RightsCheckStatus } from "@/lib/api/rights-types"
import { ScrollText, Upload } from "lucide-react"

interface RightsCheckRow {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  created_at: string
}

const STATUS_LABEL: Record<RightsCheckStatus, string> = {
  uploaded: "업로드됨", ocr_processing: "OCR 처리중", predicting: "권리추정중",
  completed: "완료", failed: "실패",
}

export default function RightsPage() {
  const [rows, setRows] = useState<RightsCheckRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<string>("계약서")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function loadRows() {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data } = await supabase
      .from("rights_checks")
      .select("id, file_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
    setRows((data as RightsCheckRow[]) || [])
  }

  useEffect(() => { loadRows() }, [])

  async function handleRun() {
    setError("")
    if (!file) { setError("PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("로그인이 필요합니다."); setBusy(false); return }

      // 1) 파일 업로드 (기존 contracts 버킷 재사용)
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file)
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)
      const { data: pub } = supabase.storage.from("contracts").getPublicUrl(path)

      // 2) rights_checks 행 생성
      const { data: inserted, error: insErr } = await supabase
        .from("rights_checks")
        .insert({ user_id: user.id, file_name: file.name, file_url: pub.publicUrl, status: "uploaded" })
        .select("id").single()
      if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)

      // 3) 파이프라인 실행
      const res = await fetch("/api/rights/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rightsCheckId: inserted.id, fileUrl: pub.publicUrl,
          fileName: file.name, documentType: docType,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        throw new Error(e?.error || `처리 실패: ${res.status}`)
      }
      window.location.href = `/rights/${inserted.id}`
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ScrollText className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-bold text-gray-900">권리추정</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">문서 유형</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">PDF 파일</label>
              <input type="file" accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={handleRun} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {busy ? "처리중..." : "권리추정 실행"}
            </button>
          </div>
        </div>

        <h2 className="text-base font-bold text-gray-700 mb-3">최근 기록</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left px-4 py-2.5">파일명</th>
                <th className="text-left px-4 py-2.5 w-[120px]">상태</th>
                <th className="text-left px-4 py-2.5 w-[160px]">생성일</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">기록이 없습니다.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/rights/${r.id}`} className="text-primary-600 hover:underline">
                      {r.file_name || r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{STATUS_LABEL[r.status] || r.status}</td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
```

- [ ] **Step 2: /rights/[id]/page.tsx 작성 (상세)**

```tsx
"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import RightsResultView from "../RightsResultView"
import type { RightsPredictResponse, RightsCheckStatus } from "@/lib/api/rights-types"
import { ArrowLeft } from "lucide-react"

interface RightsCheckDetail {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  contract_metadata: Record<string, unknown> | null
  summary: RightsPredictResponse["summary"] | null
  rights_results: RightsPredictResponse["rights_results"] | null
  evidence: RightsPredictResponse["evidence"] | null
  model: RightsPredictResponse["model"] | null
  model_info: RightsPredictResponse["model"] | null
  created_at: string
}

export default function RightsDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [row, setRow] = useState<RightsCheckDetail | null | undefined>(undefined)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setRow(null); return }
      const supabase = createClient()
      const { data } = await supabase.from("rights_checks").select("*").eq("id", id).single()
      setRow((data as RightsCheckDetail) || null)
    }
    load()
  }, [id])

  if (row === undefined) {
    return <AppLayout><div className="p-8 text-sm text-gray-400">불러오는 중...</div></AppLayout>
  }
  if (!row) {
    return <AppLayout><div className="p-8 text-sm text-gray-400">데이터가 없습니다.</div></AppLayout>
  }

  const result: RightsPredictResponse | null =
    row.rights_results ? {
      ok: true, document_id: row.id, file_name: row.file_name,
      model: row.model_info || row.model || {
        model_kind: null, base_model: null, checkpoint: null, evidence_threshold: null, top_k: null },
      summary: row.summary || { safe: 0, review: 0, none: 0, evidence_count: 0 },
      rights_results: row.rights_results,
      evidence: row.evidence || [],
    } : null

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/rights" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 권리추정 목록
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6">{row.file_name || "권리추정 결과"}</h1>

        {row.status !== "completed" ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            상태: {row.status} — 처리가 완료되지 않았습니다.
          </div>
        ) : result ? (
          <RightsResultView data={result} />
        ) : (
          <p className="text-sm text-gray-400">권리 결과가 없습니다.</p>
        )}
      </div>
    </AppLayout>
  )
}
```

- [ ] **Step 3: 타입/빌드 검증**

Run: `npx tsc --noEmit && npm run build`
Expected: 빌드 성공, `/rights`, `/rights/[id]` 라우트 생성

- [ ] **Step 4: Commit**

```bash
git add src/app/rights/page.tsx "src/app/rights/[id]/page.tsx"
git commit -m "feat(rights): 권리추정 업로드/목록/상세 페이지

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: 사이드바 메뉴 추가 + 최종 회귀 검증

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (topMenuItems 1줄 추가)

**Interfaces:**
- Consumes: 기존 Sidebar 구조.
- Produces: 사이드바에 "권리추정"(→ /rights) 메뉴.

- [ ] **Step 1: import 아이콘 추가 및 메뉴 항목 추가**

`src/components/layout/Sidebar.tsx` 6번 라인 import에 `ScrollText` 추가:
```typescript
import { FileSearch, Settings, User, LogOut, ExternalLink, Activity, ScrollText } from "lucide-react"
```
`topMenuItems` 배열(10–12라인)을 수정:
```typescript
const topMenuItems = [
  { href: "/works", label: "검사하기", icon: FileSearch },
  { href: "/rights", label: "권리추정", icon: ScrollText },
]
```
(기존 "검사하기" 항목 유지, 추가만.)

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 회귀 검증 (기존 기능 무영향 확인)**

Run: `npm run dev` 후 수동 확인 체크리스트:
- `/works` 목록/상세가 기존과 동일하게 동작(신규 코드 개입 없음)
- 사이드바에 "검사하기" + "권리추정" 둘 다 표시
- `/rights`에서 (Mock 모드, 즉 `NEXT_PUBLIC_RIGHTS_API_URL` 미설정) 업로드→결과 상세로 이동, 권리 그룹 테이블/근거/요약 표시
- `git diff --stat`로 기존 파일 변경이 Sidebar.tsx / config.ts / index.ts 3개 + 신규 파일에만 국한됨을 확인

Expected: 위 항목 모두 통과. 기존 파일 변경은 3개(모두 추가형)로 한정.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(nav): 사이드바에 권리추정 메뉴 추가

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 결과

**1. Spec coverage**
- 무영향 원칙 → Global Constraints + Task 11 Step 3 회귀 검증 ✓
- 백엔드 rights-server → Task 2–5 ✓
- SSU→권리 파이프라인 → Task 8 ✓
- 신규 메뉴/페이지 → Task 9–11 ✓
- rights_checks 테이블/RLS → Task 1 ✓
- Mock 동작(무설정 시) → Task 7(rights.ts) + Task 8(SSU 미설정 fallback) ✓
- config/index 추가 → Task 7 ✓

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TBD/TODO" 없음 ✓

**3. Type consistency:** `RightsPredictResponse`/`RightsResultItem`/`RightsEvidenceItem` 필드가 Task 6 정의 → Task 7/9/10에서 동일 사용. `predictRights(text, fileName?)` 시그니처 Task 7 정의 → Task 8 호출 일치. `rights_checks` 컬럼(Task 1) ↔ Task 8 update/Task 10 select 일치. 상세 페이지는 저장 컬럼 `model_info`를 우선 읽고 `model`로 폴백 처리 ✓

**주의(실행 시):** rights-server 코드는 전달 패키지 원본에서 발췌하므로, 발췌 시 원본 라인 범위를 정확히 옮겨야 함(특히 `FinalSchemaRightsInferenceEngine.predict`의 근거 정규화 로직). 원본 경로: `../저작권_권리추정_모델전달_API패키지_v1.1/sample/kogl_finalschema_inference_web_gui_v2.py`.
