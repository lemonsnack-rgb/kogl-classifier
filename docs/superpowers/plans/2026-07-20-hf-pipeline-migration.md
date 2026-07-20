# 통합·권리 처리 HF Pipeline 이관 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 통합검사·권리추정(파일·텍스트) 처리를 Vercel 라우트에서 KOGL Pipeline Space로 이관해, Vercel 60초 제한 없이 정상 완료되게 한다(이용자 화면 무변경).

**Architecture:** 클라이언트가 rights_checks 행을 만들고 파일/텍스트를 KOGL Pipeline Space(FastAPI, 비동기, OCR 600초 타임아웃)로 fire-and-forget 전송 → Pipeline이 SSU+HMC+Rights(HTTP)를 순차 호출하고 rights_checks를 갱신 → 상세 화면이 기존 5초 폴링으로 반영.

**Tech Stack:** FastAPI + httpx + supabase-py (Pipeline Space, Docker/HF), Next.js 14 App Router + TypeScript (프론트), Supabase.

## Global Constraints

- 저장 JSON 구조는 현재 Vercel 라우트와 **1:1 동일**. `model_info = {model_kind, base_model, checkpoint, evidence_threshold, top_k, mode, type}`; combined의 `type`=HMC 객체, rights의 `type`=`null`; `contract_metadata`는 combined `{contract, works[]}`, rights(파일) consolidated 맵.
- 값을 임의 생성 금지 — API 응답값 그대로 저장.
- 이용자 화면·조작 무변경. 검사하기 흐름 무변경.
- Pipeline Space env(기존): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SSU_API_URL`, `HMC_API_URL`. 신규: `RIGHTS_API_URL`.
- 프론트 env: `NEXT_PUBLIC_PIPELINE_URL`(이미 사용, 기본 `https://ilwang-kogl-pipeline.hf.space`).
- SSU URL 기본값 `http://150.230.114.9:5000`(HTTP). Rights 기본값 `https://ilwang-kogl-rights-api.hf.space`. HMC 기본값 `https://ilwang-kogl-hmc-server.hf.space`.

---

### Task 1: Pipeline Space 소스를 저장소에 미러링

Pipeline Space 소스가 원격(HF)에만 있어 편집·버전관리가 어렵다. 저장소에 `pipeline-server/`로 미러링한다(rights-server/와 동일 패턴).

**Files:**
- Create: `pipeline-server/main.py` (HF Space `ilwang/kogl-pipeline`의 현재 main.py 원문)
- Create: `pipeline-server/requirements.txt`
- Create: `pipeline-server/Dockerfile`
- Create: `pipeline-server/README.md`

**Interfaces:**
- Produces: `pipeline-server/main.py` — 이후 Task 2~4가 이 파일을 수정.

- [ ] **Step 1: HF에서 현재 Space 파일 내려받기**

Run:
```bash
cd "c:/project/10_문정원 모델/kogl-classifier"
mkdir -p pipeline-server
curl -s "https://huggingface.co/spaces/ilwang/kogl-pipeline/raw/main/main.py" -o pipeline-server/main.py
curl -s "https://huggingface.co/spaces/ilwang/kogl-pipeline/raw/main/requirements.txt" -o pipeline-server/requirements.txt
curl -s "https://huggingface.co/spaces/ilwang/kogl-pipeline/raw/main/Dockerfile" -o pipeline-server/Dockerfile
curl -s "https://huggingface.co/spaces/ilwang/kogl-pipeline/raw/main/README.md" -o pipeline-server/README.md
```
Expected: 4개 파일 생성. `main.py`는 218줄, `requirements.txt`는 fastapi/uvicorn/httpx/python-multipart/supabase 포함.

- [ ] **Step 2: 원문 확인**

Run: `wc -l pipeline-server/main.py && head -20 pipeline-server/main.py`
Expected: 218줄, 상단에 "KOGL 파이프라인 서버" 주석.

- [ ] **Step 3: 커밋**

```bash
git add pipeline-server/
git commit -m "chore(pipeline): KOGL Pipeline Space 소스 저장소 미러링"
```

---

### Task 2: `map_ssu_to_work_fields` Python 포팅 (TDD)

TS `src/lib/api/ocr.ts`의 `mapSSUToWorkFields`를 Python으로 정확히 포팅. 저작물 20항목 + 후보키 매핑.

**Files:**
- Modify: `pipeline-server/main.py` (import 아래에 헬퍼 추가)
- Test: `pipeline-server/tests/test_map_fields.py`

**Interfaces:**
- Produces: `map_ssu_to_work_fields(meta: dict) -> dict` — Task 3의 통합 처리가 저작물별로 호출.

- [ ] **Step 1: 실패 테스트 작성**

Create `pipeline-server/tests/test_map_fields.py`:
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from main import map_ssu_to_work_fields

def test_candidate_keys_and_types():
    meta = {
        "work_title": "경복궁 야경",
        "digital_format": "JPG",
        "keyword": "문화유산",
        "language": "한국어",
        "production_date": "2026-02-10",   # created_date 후보 2순위
        "rights_holder": "한국문화정보원",   # creator/copyright_holder 후보
        "commercial_use": "허용",
        "economic_rights": "양도",           # property_rights 후보 2순위
    }
    out = map_ssu_to_work_fields(meta)
    assert out["work_name"] == "경복궁 야경"
    assert out["work_type"] is None
    assert out["digital_format"] == "JPG"
    assert out["keywords"] == ["문화유산"]
    assert out["language"] == "한국어"
    assert out["created_date"] == "2026-02-10"
    assert out["creator"] == "한국문화정보원"
    assert out["copyright_holder"] == "한국문화정보원"
    assert out["commercial_use"] == "허용"
    assert out["property_rights"] == "양도"
    assert out["usage_scope"] == "허용"          # commercial_use 후보
    # 없는 값은 None
    assert out["portrait_rights"] is None
    assert out["co_authors"] is None
    # 전체 키 개수(20항목 + 호환 2항목)
    assert len(out) == 22

def test_object_value_is_json_stringified():
    meta = {"work_title": {"ko": "제목"}}
    out = map_ssu_to_work_fields(meta)
    assert out["work_name"] == '{"ko": "제목"}'
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd pipeline-server && python -m pytest tests/test_map_fields.py -v`
Expected: FAIL — `ImportError: cannot import name 'map_ssu_to_work_fields'`

- [ ] **Step 3: 헬퍼 구현**

`pipeline-server/main.py`의 `TYPE_MAP = {...}` 정의 **바로 아래**에 추가:
```python
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd pipeline-server && python -m pytest tests/test_map_fields.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**

```bash
git add pipeline-server/main.py pipeline-server/tests/test_map_fields.py
git commit -m "feat(pipeline): map_ssu_to_work_fields Python 포팅 (+테스트)"
```

---

### Task 3: `/process-combined`·`/process-rights` 엔드포인트 추가

통합·권리 백그라운드 처리 엔드포인트. SSU/HMC/Rights 호출 헬퍼 + rights_checks 갱신.

**Files:**
- Modify: `pipeline-server/main.py` (env 추가, 헬퍼 3종, 엔드포인트 2종)

**Interfaces:**
- Consumes: `map_ssu_to_work_fields`(Task 2), `get_supabase`, `SSU_API_URL`, `HMC_API_URL`(기존).
- Produces: `POST /process-combined`, `POST /process-rights` — Task 5 프론트가 호출.

- [ ] **Step 1: RIGHTS_API_URL 환경변수 추가**

`pipeline-server/main.py`의 `HMC_API_URL = ...` 줄 **아래**에 추가:
```python
RIGHTS_API_URL = os.environ.get("RIGHTS_API_URL", "https://ilwang-kogl-rights-api.hf.space")
```

- [ ] **Step 2: 호출 헬퍼 3종 추가**

`map_ssu_to_work_fields` 정의 **아래**에 추가:
```python
async def _ssu_extract(client, file_bytes, file_name, document_type):
    files = {"file": (file_name, file_bytes, "application/octet-stream")}
    data = {"document_type": document_type, "consolidate": "true"}
    r = await client.post(f"{SSU_API_URL}/api/llm-extract", files=files, data=data)
    r.raise_for_status()
    return r.json()


async def _hmc_classify(client, ocr_text, file_name):
    r = await client.post(
        f"{HMC_API_URL}/api/predict",
        json={"text": ocr_text, "file_name": file_name, "auto_detect_form": True},
    )
    r.raise_for_status()
    return r.json()


async def _rights_predict(client, ocr_text, file_name):
    r = await client.post(
        f"{RIGHTS_API_URL}/api/v1/rights/predict",
        json={
            "file_name": file_name or "",
            "text": ocr_text,
            "options": {
                "max_length": 512, "max_evidence": 20, "evidence_threshold": 0.7,
                "return_offsets": True, "return_evidence_text": True, "include_debug": False,
            },
        },
    )
    r.raise_for_status()
    return r.json()
```

- [ ] **Step 3: `/process-combined` 추가**

`pipeline-server/main.py`의 `if __name__ == "__main__":` **위**에 추가:
```python
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
            # 1) 계약서 SSU
            ssu = await _ssu_extract(client, contract_bytes, contract_name, document_type)
            ocr_text = ssu.get("ocr_text", "") or ""
            contract_meta = ssu.get("consolidated_metadata") or ssu.get("metadata")
            # 2) 저작물 SSU (각각)
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
            # 3) 공공누리 유형 (HMC, 실패는 비치명적)
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
            # 4) 권리 추정
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
```

- [ ] **Step 4: `/process-rights` 추가**

바로 아래에 추가:
```python
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
```

- [ ] **Step 5: 문법 검사**

Run: `cd pipeline-server && python -c "import ast; ast.parse(open('main.py',encoding='utf-8').read()); print('syntax OK')"`
Expected: `syntax OK`

- [ ] **Step 6: 기존 map 테스트 회귀 확인**

Run: `cd pipeline-server && python -m pytest tests/ -v`
Expected: PASS (2 passed)

- [ ] **Step 7: 커밋**

```bash
git add pipeline-server/main.py
git commit -m "feat(pipeline): /process-combined·/process-rights 엔드포인트 추가"
```

---

### Task 4: Pipeline Space 배포 + 시크릿 추가 + health 확인

미러된 소스를 HF Space에 push하고 `RIGHTS_API_URL` 시크릿을 추가한다. **HF Write 토큰 필요(사용자 제공).**

**Files:** (원격 HF Space `ilwang/kogl-pipeline`)

- [ ] **Step 1: HF 로그인**

사용자에게 HF Write 토큰을 요청한 뒤:
Run: `python -c "from huggingface_hub import login; login(token='<HF_WRITE_TOKEN>')"`
Expected: 로그인 성공 메시지.

- [ ] **Step 2: `RIGHTS_API_URL` 시크릿 추가**

Run:
```bash
python -c "from huggingface_hub import add_space_secret; add_space_secret(repo_id='ilwang/kogl-pipeline', key='RIGHTS_API_URL', value='https://ilwang-kogl-rights-api.hf.space')"
```
Expected: 오류 없음.

- [ ] **Step 3: main.py 업로드(배포)**

Run:
```bash
python -c "from huggingface_hub import upload_file; upload_file(path_or_fileobj='pipeline-server/main.py', path_in_repo='main.py', repo_id='ilwang/kogl-pipeline', repo_type='space')"
```
Expected: 업로드 성공 → Space 자동 재빌드 시작.

- [ ] **Step 4: 재빌드 대기 후 health 확인**

Run(빌드 1~2분 후): `curl -s https://ilwang-kogl-pipeline.hf.space/health`
Expected: `{"ok":true,"ssu_api":"http://150.230.114.9:5000","hmc_api":"...","supabase":true}`

- [ ] **Step 5: 신규 엔드포인트 등록 확인**

Run: `curl -s https://ilwang-kogl-pipeline.hf.space/openapi.json | python -c "import sys,json; d=json.load(sys.stdin); print([p for p in d['paths']])"`
Expected: 목록에 `/process-combined`, `/process-rights` 포함.

---

### Task 5: 프론트 `combined/new`·`rights/new`를 HF로 전송하도록 변경

**Files:**
- Modify: `src/app/combined/new/page.tsx`
- Modify: `src/app/rights/new/page.tsx`

**Interfaces:**
- Consumes: `POST /process-combined`, `/process-rights`(Task 3/4).

- [ ] **Step 1: combined/new — Storage 업로드 제거, HF 전송으로 교체**

`src/app/combined/new/page.tsx`의 `handleRun` 함수 본문을 아래로 교체(uploadOne 함수 및 Storage 관련 로직 제거):
```tsx
  async function handleRun() {
    setError("")
    if (!inspectionName.trim()) { setError("검사 명칭을 입력하세요."); return }
    if (!contractFile) { setError("계약서 PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("로그인이 필요합니다."); setBusy(false); return }

      const title = inspectionName.trim()
      const { data: inserted, error: insErr } = await supabase
        .from("rights_checks")
        .insert({ user_id: user.id, status: "uploaded", file_name: title, model_info: { mode: "combined" } })
        .select("id").single()
      if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)

      const PIPELINE_URL = process.env.NEXT_PUBLIC_PIPELINE_URL || "https://ilwang-kogl-pipeline.hf.space"
      const fd = new FormData()
      fd.append("rights_check_id", inserted.id)
      fd.append("document_type", docType)
      fd.append("contract", contractFile)
      for (const wf of workFiles) fd.append("works", wf)
      fetch(`${PIPELINE_URL}/process-combined`, { method: "POST", body: fd })
        .catch((e) => console.error("파이프라인 오류:", e))

      router.push(`/combined/${inserted.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
      setBusy(false)
    }
  }
```
그리고 파일 상단의 `uploadOne` 함수 정의를 **삭제**한다.

- [ ] **Step 2: rights/new — HF 전송으로 교체**

`src/app/rights/new/page.tsx`의 `runProcess`, `handleRunFile`, `handleRunText`를 아래 단일 흐름으로 교체:
```tsx
  const PIPELINE_URL = process.env.NEXT_PUBLIC_PIPELINE_URL || "https://ilwang-kogl-pipeline.hf.space"

  async function createRow(fileName: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("로그인이 필요합니다.")
    const { data: inserted, error: insErr } = await supabase
      .from("rights_checks")
      .insert({ user_id: user.id, status: "uploaded", file_name: fileName })
      .select("id").single()
    if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)
    return inserted.id as string
  }

  async function handleRunFile() {
    setError("")
    if (!inspectionName.trim()) { setError("검사 명칭을 입력하세요."); return }
    if (!file) { setError("PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const id = await createRow(inspectionName.trim())
      const fd = new FormData()
      fd.append("rights_check_id", id)
      fd.append("document_type", docType)
      fd.append("file", file)
      fetch(`${PIPELINE_URL}/process-rights`, { method: "POST", body: fd })
        .catch((e) => console.error("파이프라인 오류:", e))
      router.push(`/rights/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류"); setBusy(false)
    }
  }

  async function handleRunText() {
    setError("")
    if (!text.trim()) { setError("계약서 본문 텍스트를 입력하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const label = `텍스트 입력 · ${docType}`
      const id = await createRow(label)
      const fd = new FormData()
      fd.append("rights_check_id", id)
      fd.append("document_type", docType)
      fd.append("text", text)
      fetch(`${PIPELINE_URL}/process-rights`, { method: "POST", body: fd })
        .catch((e) => console.error("파이프라인 오류:", e))
      router.push(`/rights/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류"); setBusy(false)
    }
  }
```

- [ ] **Step 3: 타입체크·빌드**

Run: `cd "c:/project/10_문정원 모델/kogl-classifier" && npx tsc --noEmit && npm run build 2>&1 | grep -E "Compiled successfully|Failed|error TS"`
Expected: `Compiled successfully`, TS 에러 없음. (사용하지 않게 된 import가 있으면 제거)

- [ ] **Step 4: 커밋**

```bash
git add src/app/combined/new/page.tsx src/app/rights/new/page.tsx
git commit -m "feat: 통합·권리 업로드를 HF Pipeline로 전송(fire-and-forget)"
```

---

### Task 6: Vercel 처리 라우트 제거

이관 완료로 Vercel `/api/*/process`는 미사용. 제거한다.

**Files:**
- Delete: `src/app/api/combined/process/route.ts`
- Delete: `src/app/api/rights/process/route.ts`

- [ ] **Step 1: 라우트 삭제**

Run:
```bash
cd "c:/project/10_문정원 모델/kogl-classifier"
git rm src/app/api/combined/process/route.ts src/app/api/rights/process/route.ts
```

- [ ] **Step 2: 참조 잔존 확인**

Run: `grep -rn "api/combined/process\|api/rights/process" src/ || echo "참조 없음"`
Expected: `참조 없음`

- [ ] **Step 3: 빌드 확인**

Run: `npm run build 2>&1 | grep -E "Compiled successfully|Failed|error TS"`
Expected: `Compiled successfully`

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: 사용 안 하는 Vercel 처리 라우트 제거(HF 이관 완료)"
```

---

### Task 7: API 명세서 §4 갱신

내부 라우트 대신 HF Pipeline 엔드포인트를 문서화.

**Files:**
- Modify: `docs/API_명세서.md` (§4 "앱 내부 라우트")

- [ ] **Step 1: §4 본문 교체**

`docs/API_명세서.md`의 "## 4. 앱 내부 라우트" 섹션 아래 4.1/4.2 설명을, Vercel 라우트가 아닌 **HF Pipeline 엔드포인트**로 갱신한다. 4.1을 `POST {PIPELINE_URL}/process-combined`(multipart: `rights_check_id`, `document_type`, `contract` 파일, `works` 파일 N), 4.2를 `POST {PIPELINE_URL}/process-rights`(multipart: `rights_check_id`, `document_type`, `file` 또는 `text`)로 서술하고, 처리 흐름·저장 필드(§4.2 파이프라인 상태)는 유지. `PIPELINE_URL = NEXT_PUBLIC_PIPELINE_URL`(기본 `https://ilwang-kogl-pipeline.hf.space`) 명시. Vercel 60초 제약으로 인해 처리를 HF로 이관했다는 한 줄 배경을 추가.

- [ ] **Step 2: 커밋**

```bash
git add docs/API_명세서.md
git commit -m "docs: API 명세서 §4를 HF Pipeline 엔드포인트로 갱신"
```

---

### Task 8: E2E 검증 + 배포 + 정리

**Files:** (검증 전용, 코드 변경 없음)

- [ ] **Step 1: 프론트 프로덕션 배포**

Run: `cd "c:/project/10_문정원 모델/kogl-classifier" && vercel --prod --yes 2>&1 | grep -iE "Aliased:|Error:"`
Expected: `Aliased: https://kogl-classifier.vercel.app`

- [ ] **Step 2: 통합검사 E2E (저작물 2건)**

브라우저(왕일 로그인)에서 `/combined/new` → 검사명 입력, 계약서 + 저작물 2건 업로드 → 실행. 상세로 이동해 스텝퍼(업로드→OCR→유형·권리) 진행 후 `completed` 확인.
검증: "저작물 메타데이터 (2건)" 목록+선택 조회, 공공누리 유형, 권리 그룹 테이블, 근거 하이라이트 표출. DB `status=completed`, `contract_metadata.works` 길이 2.

- [ ] **Step 3: 권리추정 E2E (파일 + 텍스트)**

`/rights/new`에서 (a) PDF 파일, (b) 텍스트 입력 각각 실행 → 상세에서 `completed` + 권리 판정표 표출 확인.

- [ ] **Step 4: 검사하기 회귀 확인**

`/works` 목록·상세가 기존대로 표출되는지 확인(무변경).

- [ ] **Step 5: 검증용 레코드 정리**

서비스롤로 검증용 rights_checks 레코드 삭제(기존 데이터는 보존).

- [ ] **Step 6: 원격 push**

```bash
git push origin feature/rights-estimation:master
git push origin feature/rights-estimation
```

---

## Self-Review 결과

- **Spec coverage:** §3 아키텍처→Task 1·3·4, §4 엔드포인트→Task 3, §4.3 데이터 동일성→Task 2·3(model_info/contract_metadata 구조), §5 프론트→Task 5, §6 정리·문서→Task 6·7, §8 검증→Task 8. 누락 없음.
- **Placeholder scan:** 코드 스텝 전부 실제 코드 포함. Task 7만 서술형(문서 편집)으로, 대상 섹션·필드를 구체 명시.
- **Type consistency:** `map_ssu_to_work_fields`(Task 2)를 Task 3에서 동일 시그니처로 호출. `rights_check_id`/`document_type`/`contract`/`works`/`file`/`text` 폼 필드명이 Task 3(서버)와 Task 5(클라이언트)에서 일치.
