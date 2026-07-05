# 권리추정(Rights Estimation) 기능 추가 — 설계 문서

- 작성일: 2026-07-05
- 대상 저장소: `kogl-classifier` (Next.js 14 App Router + Supabase)
- 전달 패키지: `저작권_권리추정_모델전달_API패키지_v1.1` (권리추정 `.pt` 모델 + 추론 예제 소스)

## 0. 최우선 원칙 — 기존 기능 무영향

이 작업의 **가장 중요한 제약**은 기존 "검사하기"(SSU 메타데이터 + HMC 유형 분류) 기능에
어떤 영향도 주지 않는 것이다.

- 기존 라우트(`/works`, `/works/[id]`, `/works/new`, `/admin/*` 등), 기존 API 라우트
  (`/api/pipeline/process`), 기존 어댑터(`classifier.ts`, `ocr.ts`), 기존 타입(`types.ts`,
  `src/types/index.ts`), 기존 테이블(`contracts`, `works`, `contract_clauses` 등)은
  **수정하지 않는다.**
- 유일하게 허용되는 기존 파일 수정은 **사이드바 메뉴 한 줄 추가**(`Sidebar.tsx`)와
  **설정 파일에 신규 항목 추가**(`config.ts`, `index.ts` re-export)뿐이며, 기존 항목은
  그대로 둔다.
- DB는 신규 테이블(`rights_checks`)만 추가하는 마이그레이션으로 처리한다. 기존 테이블
  스키마는 변경하지 않는다.
- 신규 기능은 별도 환경변수(`NEXT_PUBLIC_RIGHTS_API_URL`)로만 활성화되며, 미설정 시
  Mock으로 동작하여 기존 배포에 영향을 주지 않는다.

## 1. 배경 / 목표

전달받은 권리추정 모델은 계약서 텍스트를 입력받아 개별 권리(복제권/전시권/대여권/
2차적저작물작성권 등)마다 판정(허용/금지/-), 신뢰도, 근거(span)를 반환한다. 이는 기존
KOGL 유형(유형1~4) 분류와는 **다른 새로운 출력 스키마**를 가진 별개 기능이다.

목표: 기존 기능을 그대로 유지한 채, **독립된 새 메뉴 "권리추정"**을 추가하여 PDF 업로드 →
텍스트화(OCR) + 메타데이터 추출 → 권리추정 → 결과 표시/저장까지의 흐름을 제공한다.

## 2. 아키텍처 개요

```
[사이드바 신규 메뉴 "권리추정" → /rights]
        │
        ▼
[신규 페이지 /rights]  PDF 업로드 + 최근 기록 목록
        │  POST /api/rights/process  (Next 서버 라우트, 프록시+저장)
        ▼
1) 종전 SSU API  POST {SSU}/api/llm-extract   → OCR 텍스트 + 메타데이터   [기존 API, 무변경]
        │
2) 신규 권리 서버 POST {RIGHTS}/api/v1/rights/predict  (OCR 텍스트 입력)   [이번 추가]
        │
        ▼
[신규 테이블 rights_checks]에 저장  →  [신규 페이지 /rights/[id]] 결과 상세 표시
```

파이프라인 순서(사용자 확정): **PDF → SSU(OCR+메타데이터) → 권리추정 → 결과(메타데이터 + 권리 판정)**.
권리 모델 입력이 텍스트이므로 PDF→텍스트 단계가 반드시 선행되며, 이 단계는 기존 SSU API를
재사용한다. HMC 유형 분류는 이 메뉴에서 호출하지 않는다(기존 "검사하기" 전용으로 유지).

## 3. 백엔드 — 권리 전용 FastAPI 서버

- 위치: `kogl-classifier/rights-server/` (Next 앱과 분리된 독립 Python 프로젝트)
- 근거: 전달 패키지의 `sample/kogl_finalschema_inference_web_gui_v2.py`에서 권리 엔진
  (`FinalSchemaGroundedModel`, `FinalSchemaRightsInferenceEngine`) 및 관련 상수/헬퍼
  (`DEFAULT_SCHEMA`, `AUTHORITY_GROUP_KO`, `STATUS_KO`, 근거 필터 함수 등)만 추출·재사용한다.
  유형 엔진(`TypeInferenceEngine`)과 유형 관련 코드는 포함하지 않는다.
- 엔드포인트:
  - `GET /api/v1/health` — 모델 로드 상태, base_model, threshold, top_k, device 반환
  - `POST /api/v1/rights/predict` — 명세서 스키마 그대로:
    - 요청: `{ document_id?, file_name?, text, options?: { max_length, max_evidence, evidence_threshold, return_offsets, return_evidence_text, include_debug } }`
    - 응답: `{ ok, document_id, file_name, model{...}, summary{safe,review,none,evidence_count}, rights_results[], evidence[] }`
    - `rights_results[]`: `{ group, authority, authority_ko, status, display_result, confidence, evidence_numbers[], review_required }`
    - `evidence[]`: `{ evidence_no, authority, authority_ko, status, text, start_char, end_char, confidence }`
    - UNKNOWN은 `display_result: "-"`, `confidence: null`, `evidence_numbers: []`로 처리.
- 모델 경로: 환경변수 `RIGHTS_MODEL_PATH` (기본값 `./model/권리추정_260610.pt`). 모델 파일은
  보안/용량 정책상 저장소에 커밋하지 않고 운영 환경에 별도 배치한다(`.gitignore`).
- 서버 시작 시 모델 자동 로드(`startup` 이벤트). 로드 실패 시 `/health`에 에러 노출.
- `requirements.txt`(torch, transformers, fastapi, uvicorn, pydantic, pymupdf/pypdf 선택),
  `README.md`(로컬 실행: `uvicorn app:app --port 8080`) 포함.
- 기본 파라미터: `evidence_threshold=0.70`, `top_k=5`, `max_length=512`, `max_evidence=20`.

## 4. 프론트엔드

### 4.1 메뉴/라우트
- `src/components/layout/Sidebar.tsx`의 `topMenuItems`에 항목 1개 추가:
  `{ href: "/rights", label: "권리추정", icon: ScrollText }` (lucide-react 아이콘). 기존
  "검사하기" 항목은 그대로 둔다.
- 신규 라우트:
  - `/rights` — 업로드 입력 + 최근 기록 목록
  - `/rights/[id]` — 권리추정 결과 상세

### 4.2 신규 페이지/컴포넌트
- `src/app/rights/page.tsx`
  - PDF 파일 업로드 폼(문서유형 선택 재사용 가능) + "권리추정 실행" 버튼
  - 본인 `rights_checks` 최근 기록 목록(상태 배지, 파일명, 생성일)
  - 기존 `AppLayout` 사용, 기존 디자인 토큰/스타일 컨벤션 준수
- `src/app/rights/[id]/page.tsx`
  - 좌: 문서/메타데이터 요약(기존 메타데이터 렌더링 패턴 참고, 단 컴포넌트는 신규 작성하여
    기존 파일 의존 최소화)
  - 우: 권리 판정 결과 — 그룹별 표(저작재산권 / 이용조건 / 계약성격 / 이용범위 / 대가조건),
    각 행: 권리명 · status 배지(허용=초록 / 금지=빨강 / - =회색 / 확인필요=주황) · 신뢰도 ·
    근거번호. 하단에 근거 목록(번호, 텍스트, 신뢰도). 요약 집계(허용/확인필요/없음).
  - 초기 버전은 조회 전용(수정 기능은 범위 외, 향후 확장 여지만 남김).

### 4.3 어댑터/타입
- `src/lib/api/rights-types.ts` — 요청/응답 TypeScript 타입(3장 스키마와 1:1).
- `src/lib/api/rights.ts` — `predictRights(text, fileName)` 및 `checkRightsHealth()`.
  `NEXT_PUBLIC_RIGHTS_API_URL` 미설정 시 Mock 응답 반환(전달 패키지의
  `sample_rights_response.json` 기반 목업).
- `src/lib/api/config.ts` — `RIGHTS_API_BASE_URL` 및 `useMockRights` getter **추가**(기존
  SSU/HMC 항목은 유지).
- `src/lib/api/index.ts` — 신규 심볼 re-export 추가(기존 export 유지).

### 4.4 서버 라우트 (파이프라인)
- `src/app/api/rights/process/route.ts` — 기존 `src/app/api/pipeline/process/route.ts`
  패턴을 차용하되 별도 파일로 신규 작성:
  1. `rights_checks` 행 생성(status=`uploaded`) 또는 요청에서 id 수신
  2. Supabase Storage에서 업로드 PDF 다운로드
  3. 종전 SSU `/api/llm-extract` 호출 → `ocr_text`, `contract_metadata` 저장
     (status=`predicting`)
  4. 신규 권리 서버 `/api/v1/rights/predict` 호출(입력=ocr_text) → `summary`,
     `rights_results`, `evidence`, `model_info` 저장(status=`completed`)
  5. 실패 단계별 status(`failed`) 처리
  - Service Role Key 사용(기존 pipeline 라우트와 동일). 기존 pipeline 라우트는 수정하지 않음.

## 5. 데이터베이스

신규 마이그레이션 `supabase/migrations/002_rights_checks.sql` (기존 001 무변경):

```sql
CREATE TABLE rights_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name TEXT,
  file_url TEXT,
  ocr_text TEXT,
  contract_metadata JSONB,          -- SSU 추출 메타데이터
  summary JSONB,                    -- {safe, review, none, evidence_count}
  rights_results JSONB,             -- 권리별 판정 배열
  evidence JSONB,                   -- 근거 배열
  model_info JSONB,                 -- {model_kind, base_model, checkpoint, evidence_threshold, top_k}
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'ocr_processing', 'predicting', 'completed', 'failed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rights_checks_user_id ON rights_checks(user_id);
CREATE INDEX idx_rights_checks_created_at ON rights_checks(created_at DESC);

ALTER TABLE rights_checks ENABLE ROW LEVEL SECURITY;

-- 본인 CRUD + 관리자 전체 조회 (기존 contracts 정책과 동일 패턴)
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

- Storage: 기존 `contracts` 버킷 재사용 가능(또는 신규 `rights` 버킷). 기존 버킷 재사용 시
  버킷 정책 변경 없음.

## 6. 설정 / 환경변수

`.env.local` (신규 항목만 추가, 기존 유지):
```
NEXT_PUBLIC_RIGHTS_API_URL=http://127.0.0.1:8080   # 권리 서버 (미설정 시 Mock)
RIGHTS_MODEL_PATH=./model/권리추정_260610.pt         # rights-server용
```

## 7. 검증 계획

- 백엔드: `rights-server` 로컬 기동 후 `sample/test.zip`의 테스트 계약서(및
  `predict_rights_request_sample.json`)로 `/api/v1/rights/predict` 응답이
  `sample_rights_response.json` 형태와 일치하는지 확인.
- 프론트: `NEXT_PUBLIC_RIGHTS_API_URL` 미설정(Mock) 상태에서 `/rights` 업로드→결과 흐름
  확인 → 설정 후 실 API 연동 확인.
- 회귀: 기존 `/works` 흐름(업로드→SSU→HMC→결과)이 그대로 동작하는지, 신규 코드가 기존
  경로에 개입하지 않는지 확인.

## 8. 범위 밖 (YAGNI)

- 권리추정 결과 인라인 수정/편집 기능
- 기존 "검사하기"에 권리추정 통합
- 유형 모델 교체(기존 HMC 유지)
- 모델 재학습/파인튜닝
- rights-server 프로덕션 배포 자동화(로컬 실행 가이드까지만 제공)
