# 통합·권리 처리의 HF Pipeline 이관 — 설계 문서

- 작성일: 2026-07-20
- 대상 저장소: `kogl-classifier`
- 관련: [API 명세서](../../API_명세서.md), [이용매뉴얼](../../이용매뉴얼.md)

## 1. 배경 / 문제

`combined/new`(통합검사)와 `rights/new`(권리추정, 파일 기반)는 Vercel 서버리스 라우트(`/api/combined/process`, `/api/rights/process`)에서 SSU OCR·메타데이터 추출 + 공공누리 유형(HMC) + 권리추정을 **동기 처리**한다.

- Vercel 플랜 = **Hobby → 함수 실행 최대 60초**(`maxDuration=300`을 넣어도 Hobby에서는 60초로 클램프).
- SSU `/api/llm-extract`는 소형 파일(18KB 이미지)에도 **~80초** 소요(VLM 기반 OCR). `/health`는 655ms로 정상.
- 결과: SSU 1건 호출만으로도 60초를 초과 → 함수가 중단되어 레코드가 `ocr_processing` 상태로 **영구 멈춤**.

즉 **타임아웃 설정 문제가 아니라 플랜·처리구조 문제**다.

## 2. 목표 / 비목표

**목표**
- 통합검사 및 권리추정(파일·텍스트)이 **정상 완료**되도록 한다.
- **이용자가 보는 화면·조작은 100% 무변경**(업로드 폼, 상세 스텝퍼·폴링, 결과 뷰, 목록/검색 모두 그대로).
- 저장 데이터 구조를 **현재와 1:1 동일**하게 유지(상세 화면·API 명세서 호환).

**비목표**
- 검사하기 흐름 변경(이미 HF Pipeline에서 처리, 무변경).
- UI/디자인 변경, 신규 화면 추가.
- Vercel 플랜 업그레이드(선택지에서 제외됨).

## 3. 아키텍처

검사하기와 동일하게 **KOGL Pipeline Space**(FastAPI/Docker, 비동기 httpx, OCR 600초·분류 120초 타임아웃 — Vercel 60초 제약 없음)가 백그라운드로 오케스트레이션한다.

```
[클라이언트]
  1) rights_checks 행 생성 (status=uploaded, mode=combined|rights)
  2) 파일/텍스트를 HF로 fire-and-forget POST
        │
        ▼
[KOGL Pipeline Space]  = 오케스트레이터
   ├ SSU /api/llm-extract      (계약서 + 저작물 N건; 각 ~80초 수용)
   ├ HMC /api/predict          (공공누리 유형)
   ├ Rights /api/v1/rights/predict  (HTTP 호출)
   └ Supabase rights_checks 갱신 (uploaded→ocr_processing→predicting→completed/failed)
        │
        ▼
[상세 화면]  기존 5초 폴링으로 실시간 반영 (무변경)
```

- Pipeline = 오케스트레이터. 모델은 HMC·Rights 스페이스가 서빙(권리는 HTTP 호출).
- Pipeline Space 시크릿: 기존 `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SSU_API_URL`, `HMC_API_URL` 재사용 + **신규 `RIGHTS_API_URL`** 추가.
- 배포에는 **HF Write 토큰**(사용자 제공)이 필요. Pipeline Space 소스는 원격(HF)에 있으므로 clone→수정→push.

## 4. 엔드포인트 (Pipeline Space에 추가)

기존 `GET /health`, `POST /process`(검사하기)는 유지.

### 4.1 `POST /process-combined` (multipart/form-data)
- 입력: `rights_check_id`(str), `document_type`(str, 기본 "계약서"), `contract`(file, 필수), `works`(file, 0..N)
- 처리 순서:
  1. `status = ocr_processing`
  2. SSU(계약서) → `ocr_text`, `contract_meta = consolidated_metadata || metadata`
  3. 각 `works[i]` → SSU → `mapSSUToWorkFields` → `{work_filename, ...20항목}`
  4. `ocr_text`, `contract_metadata = {contract, works[]}` 저장, `status = predicting`
  5. HMC(`ocr_text`) → `hmc_type = {source:"hmc", predicted_type, predicted_display, description, confidence, probabilities, evidence_sentences[]}` (유형 실패는 비치명적 → null)
  6. Rights(`ocr_text`, HTTP) → `summary, rights_results, evidence, model`
  7. 저장: `summary`, `rights_results`, `evidence`, `model_info = {...model, mode:"combined", type: hmc_type}`, `status = completed`
- 실패 시: `status = failed`.

### 4.2 `POST /process-rights` (multipart/form-data)
- 입력: `rights_check_id`(str), `document_type`(str), `file`(file, 선택), `text`(str, 선택)
- 처리:
  1. 텍스트가 있으면 `ocr_text = text`(SSU 생략). 파일이면 `status=ocr_processing` → SSU → `ocr_text`, `contract_metadata = consolidated_metadata || metadata`.
  2. `status = predicting`
  3. Rights(`ocr_text`, HTTP) → 결과
  4. 저장: `ocr_text`, (파일 시 `contract_metadata`), `summary`, `rights_results`, `evidence`, `model_info = {...model, type:null, mode:"rights"}`, `status = completed`
- 실패 시: `status = failed`.

### 4.3 데이터 구조 동일성 (필수)
저장되는 JSON은 현재 Vercel 라우트 구현과 **1:1 동일**해야 한다. 특히:
- `model_info` = `{model_kind, base_model, checkpoint, evidence_threshold, top_k, mode, type}`
- combined의 `type` = HMC 결과 객체(위 5), rights의 `type` = `null`
- `contract_metadata` = combined는 `{contract, works[]}`, rights(파일)는 consolidated 맵
- `mapSSUToWorkFields`(TS, `src/lib/api/ocr.ts`)의 **20항목·후보키 매핑을 Python으로 정확히 포팅**(값 임의 생성 금지).

## 5. 프론트엔드 변경 (최소)

- `src/app/combined/new/page.tsx`: rights_checks 행 생성 후, Vercel 호출 대신 `${NEXT_PUBLIC_PIPELINE_URL}/process-combined`로 **파일 FormData fire-and-forget** → 상세로 이동. 계약서를 Supabase Storage에 올리는 단계 제거(HF로 직접 전송).
- `src/app/rights/new/page.tsx`: rights_checks 행 생성 후 `${NEXT_PUBLIC_PIPELINE_URL}/process-rights`로 파일 또는 텍스트 전송.
- 상세(`combined/[id]`, `rights/[id]`) 폴링·스텝퍼·결과 뷰: **무변경**.
- 신규 env 불필요(`NEXT_PUBLIC_PIPELINE_URL`은 검사하기가 이미 사용).
- **`file_url` 처리**: HF로 파일을 직접 전송하므로 통합/권리 레코드의 `file_url`은 `null`이 될 수 있다. 현재 통합·권리 상세에는 파일 다운로드 UI가 없어 화면 영향 없음(무변경 전제 유지). 파일 참조가 향후 필요하면 Storage 업로드를 별도 추가.

## 6. 정리 / 문서

- Vercel 라우트 `src/app/api/combined/process/route.ts`, `src/app/api/rights/process/route.ts` **제거**(60초 제약으로 사용 불가). 앞서 추가한 `maxDuration`도 함께 제거.
- **API 명세서** §4 "앱 내부 라우트"를 HF Pipeline 엔드포인트(`/process-combined`, `/process-rights`)로 갱신.
- Pipeline Space 시크릿에 `RIGHTS_API_URL` 추가.

## 7. 리스크 / 완화

| 리스크 | 완화 |
|---|---|
| Pipeline Space 소스가 로컬에 없음 | HF에서 clone(또는 `main.py` 원문 확보) 후 수정·push. 원문 확보 실패 시 사용자에게 요청. |
| `mapSSUToWorkFields` 포팅 불일치 | TS 원본을 기준으로 필드·후보키 1:1 포팅, 실제 업로드로 결과 대조. |
| HF Space 콜드스타트(HMC·Rights sleeping) | 첫 호출 지연 감안(비동기, 폴링). 필요 시 상세 안내 문구는 기존 그대로. |
| 클라이언트→HF CORS | 검사하기가 이미 동일 패턴으로 동작 → 문제 없음(필요 시 Space CORS 확인). |
| HF Write 토큰 부재 | 배포 단계에서 사용자에게 토큰 요청(설계·코드 준비는 선행). |
| SSU가 600초도 초과 | 현재 파일당 ~80초로 여유. 초과 시 별도 대응(범위 밖). |

## 8. 검증 계획

1. Pipeline Space 배포 후 `/health` 확인.
2. 실제 통합검사(계약서 + 저작물 2건) → 600초 내 `completed` 도달, 상세에서 유형·권리·근거·저작물 다건 조회 표출.
3. 파일 권리추정 / 텍스트 권리추정 각각 정상 완료.
4. 검사하기 회귀 없음.
5. 검증용 레코드 서비스롤로 정리.

## 9. 영향 파일 요약

- **HF Pipeline Space** `main.py` — `/process-combined`, `/process-rights` 추가 + `mapSSUToWorkFields` Python 포팅 + `RIGHTS_API_URL` 사용
- `src/app/combined/new/page.tsx`, `src/app/rights/new/page.tsx` — HF로 전송하도록 변경
- `src/app/api/combined/process/route.ts`, `src/app/api/rights/process/route.ts` — 제거
- `docs/API_명세서.md` — §4 갱신
