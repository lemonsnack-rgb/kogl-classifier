# 공공저작물 권리유형 자동분류 — API 명세서

> **목적**: 본 문서는 공공저작물 권리유형 자동분류 서비스가 사용하는 API의 입출력 구조를 정의한다.
> 이 명세는 **타 개발사가 동일 기능을 구현·연동·테스트할 때의 기준 문서**이며, 프로토타입(`kogl-classifier`)의 실제 동작과 1:1로 일치한다.
>
> **원칙**: 각 API의 요청/응답 구조는 벤더가 전달한 API를 **그대로** 반영한다. 표시 화면의 모든 값은 API 응답값과 동일하다.
>
> - 대상 독자: 연동 개발사, 시험 담당자, 한국문화정보원(공공누리 운영기관) 관리자
> - 최종 검증: 3개 벤더 API 라이브 호출로 응답 구조 확인 완료
> - 기준 버전: `rights-v1` (권리추정), HMC `/api/predict`, SSU `/api/llm-extract`

---

## 1. 시스템 구성

서비스는 **3개 벤더 API**를 조합해 동작하며, 프론트엔드(Next.js)는 **2개 내부 라우트**를 통해 이들을 오케스트레이션한다.

| 구분 | API | 제공 | 역할 | Base URL(환경변수) |
|---|---|---|---|---|
| 벤더 | 공공누리 유형분류 | HM컴퍼니 | 계약서 텍스트 → 공공누리 유형1~4 | `NEXT_PUBLIC_HMC_API_URL` |
| 벤더 | 권리추정 | HM컴퍼니 | 계약서 텍스트 → 권리 항목별 허용/금지 판정 | `NEXT_PUBLIC_RIGHTS_API_URL` |
| 벤더 | OCR·메타데이터 추출 | 숭실대 산학협력단 | 파일 → OCR 텍스트 + 메타데이터 | `NEXT_PUBLIC_SSU_API_URL` |
| 내부 | `/api/rights/process` | 본 서비스 | 권리추정 파이프라인(SSU→권리) | (동일 오리진) |
| 내부 | `/api/combined/process` | 본 서비스 | 통합 파이프라인(SSU→유형→권리) | (동일 오리진) |

### 메뉴별 사용 API

| 메뉴 | SSU(OCR·메타) | HMC(유형) | 권리추정 |
|---|:---:|:---:|:---:|
| 검사하기 | ✅ | ✅ | — |
| 권리추정 | ✅ (파일 업로드 시) | — | ✅ |
| 통합검사 | ✅ | ✅ | ✅ |

### 데이터 흐름 (통합검사 기준)

```
[파일 업로드]
   │  계약서 PDF + 저작물 파일(선택, 복수)
   ▼
[SSU /api/llm-extract]  ── OCR 텍스트 + 계약서 메타데이터 + 저작물 20항목 메타데이터
   ▼
[HMC /api/predict]      ── 공공누리 유형1~4 + 근거 문장
   ▼
[권리추정 /api/v1/rights/predict] ── 권리 항목별 허용/금지 + 근거
   ▼
[결과 화면]  메타데이터 · 공공누리 유형 · 권리 판정 · 근거 하이라이트
```

---

## 2. 공통 규약

- **프로토콜**: HTTPS, `Content-Type: application/json` (SSU 업로드 계열은 `multipart/form-data`)
- **문자 인코딩**: UTF-8
- **인증**: 벤더 API는 네트워크 접근 제어 기반(별도 토큰 없음, 배포 환경별 상이). HF Space 비공개 시 `HF_TOKEN` 필요.
- **에러 응답(FastAPI 계열)**: HTTP 4xx/5xx + `{ "detail": "<메시지>" }`
- **에러 응답(SSU)**: `{ "success": false, "error": "<메시지>", "request_id": "<id>" }`
- **금액·신뢰도**: 신뢰도(`confidence`)는 0~1 실수. 미확정 항목은 `null`.

---

## 3. 벤더 API

### 3.1 권리추정 API (HM컴퍼니)

계약서 본문 텍스트에서 저작재산권·이용조건 등 권리 항목별 허용/금지를 추정한다.

- **모델**: `authority_finalschema_multilabel_grounded_v4` (base: `klue/roberta-base`, checkpoint: `권리추정_260610.pt`)
- **Base URL**: `NEXT_PUBLIC_RIGHTS_API_URL`

#### 3.1.1 `POST /api/v1/rights/predict`

**요청**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|:---:|---|---|
| `text` | string | ✅ | — | 계약서 본문 텍스트(OCR 결과) |
| `document_id` | string | | `null` | 문서 식별자(호출자 지정) |
| `file_name` | string | | `null` | 파일명(표시용) |
| `options.max_length` | int | | 512 | 최대 토큰 길이 |
| `options.max_evidence` | int | | 20 | 최대 근거 개수 |
| `options.evidence_threshold` | float | | (모델 기본) | 근거 임계값 |
| `options.return_offsets` | bool | | true | 근거 문자 위치 반환 |
| `options.return_evidence_text` | bool | | true | 근거 원문 반환 |
| `options.include_debug` | bool | | false | 디버그 정보 포함 |

```json
{
  "file_name": "콘텐츠 저작재산권 양도계약서.pdf",
  "text": "콘텐츠 저작재산권 양도계약서 ☑ 복제권, □ 전시권 ... 유상 사업에 이용할 수 있다.",
  "options": {
    "max_length": 512,
    "max_evidence": 20,
    "evidence_threshold": 0.7,
    "return_offsets": true,
    "return_evidence_text": true,
    "include_debug": false
  }
}
```

**응답**

| 필드 | 타입 | 설명 |
|---|---|---|
| `ok` | bool | 성공 여부 |
| `document_id` | string\|null | 요청의 document_id 에코 |
| `file_name` | string\|null | 요청의 file_name 에코 |
| `model` | object | 모델 정보(`model_kind`, `base_model`, `checkpoint`, `evidence_threshold`, `top_k`) |
| `summary` | object | 판정 요약(`safe`, `review`, `none`, `evidence_count`) |
| `rights_results` | array | 권리 항목별 판정 목록 (아래 표) |
| `evidence` | array | 근거 목록 (아래 표) |

`rights_results[]` 항목:

| 필드 | 타입 | 설명 |
|---|---|---|
| `group` | string | 권리 그룹(§5.1) |
| `authority` | string | 권리 코드(§5.1) |
| `authority_ko` | string | 권리 한글명 |
| `status` | string | 판정 상태(§5.2). 미식별=`UNKNOWN` |
| `display_result` | string | 표시용 판정("허용"/"금지"/"-") |
| `confidence` | float\|null | 신뢰도(0~1), 미식별 시 `null` |
| `evidence_numbers` | int[] | 연결된 근거 번호(`evidence.evidence_no`) |
| `review_required` | bool | 확인필요 여부 |

`evidence[]` 항목 (명세 고정 8필드):

| 필드 | 타입 | 설명 |
|---|---|---|
| `evidence_no` | int | 근거 번호 |
| `authority` | string | 권리 코드 |
| `authority_ko` | string | 권리 한글명 |
| `status` | string | 판정 상태(§5.2) |
| `text` | string | 근거 문장 원문 |
| `start_char` | int | 원문 내 시작 위치 |
| `end_char` | int | 원문 내 끝 위치 |
| `confidence` | float | 근거 신뢰도(0~1) |

```json
{
  "ok": true,
  "document_id": null,
  "file_name": "콘텐츠 저작재산권 양도계약서.pdf",
  "model": {
    "model_kind": "authority_finalschema_multilabel_grounded_v4",
    "base_model": "klue/roberta-base",
    "checkpoint": "권리추정_260610.pt",
    "evidence_threshold": 0.7,
    "top_k": 5
  },
  "summary": { "safe": 5, "review": 2, "none": 9, "evidence_count": 5 },
  "rights_results": [
    {
      "group": "저작재산권", "authority": "RIGHT_REPRODUCTION", "authority_ko": "복제권",
      "status": "ALLOW", "display_result": "허용", "confidence": 0.984,
      "evidence_numbers": [1], "review_required": false
    },
    {
      "group": "저작재산권", "authority": "RIGHT_EXHIBITION", "authority_ko": "전시권",
      "status": "PROHIBIT", "display_result": "금지", "confidence": 0.972,
      "evidence_numbers": [2], "review_required": false
    },
    {
      "group": "이용범위", "authority": "TERRITORY_SCOPE", "authority_ko": "이용지역",
      "status": "UNKNOWN", "display_result": "-", "confidence": null,
      "evidence_numbers": [], "review_required": true
    }
  ],
  "evidence": [
    {
      "evidence_no": 1, "authority": "RIGHT_REPRODUCTION", "authority_ko": "복제권",
      "status": "ALLOW", "text": "☑ 복제권", "start_char": 14, "end_char": 20, "confidence": 0.93
    },
    {
      "evidence_no": 2, "authority": "RIGHT_EXHIBITION", "authority_ko": "전시권",
      "status": "PROHIBIT", "text": "□ 전시권", "start_char": 22, "end_char": 28, "confidence": 0.91
    }
  ]
}
```

> **주의**: 본 엔드포인트는 **권리 판정만** 반환한다(공공누리 유형은 반환하지 않음). 유형은 §3.2 HMC API가 담당한다. 응답에 `type` 필드는 포함되지 않는다.

#### 3.1.2 `GET /api/v1/health`

```json
{
  "ok": true,
  "right_loaded": true,
  "right_error": null,
  "model": {
    "model_kind": "authority_finalschema_multilabel_grounded_v4",
    "base_model": "klue/roberta-base",
    "checkpoint": "권리추정_260610.pt",
    "evidence_threshold": 0.7,
    "top_k": 5
  }
}
```

---

### 3.2 공공누리 유형분류 API (HM컴퍼니)

계약서 OCR 텍스트에서 공공누리 유형(제1~4유형)을 분류한다.

- **Base URL**: `NEXT_PUBLIC_HMC_API_URL`

#### 3.2.1 `POST /api/predict`

**요청**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|:---:|---|---|
| `text` | string | ✅ | — | 계약서 OCR 텍스트 |
| `file_name` | string | | "" | 파일명 |
| `engine_id` | string | | (서버 기본) | 엔진 ID |
| `strip_article_titles` | bool | | true | 조항 제목 제거 |
| `normalize_whitespace` | bool | | true | 공백 정규화 |
| `remove_page_artifacts` | bool | | true | 페이지 아티팩트 제거 |
| `prediction_threshold` | float | | 0.55 | 예측 임계값 |
| `evidence_threshold` | float | | 0.30 | 근거 임계값 |
| `max_evidence_sentences` | int | | 10 | 최대 근거 문장 수 |
| `auto_detect_form` | bool | | true | 신형/구형 자동 감지 |
| `max_length` | int | | 512 | 최대 토큰 길이 |

```json
{
  "text": "본 계약에 의한 저작물의 저작재산권은 발주기관에 귀속한다. 이용자는 출처를 표시하여야 한다.",
  "file_name": "계약서.pdf",
  "auto_detect_form": true,
  "prediction_threshold": 0.55,
  "evidence_threshold": 0.30,
  "max_evidence_sentences": 10
}
```

**응답**

| 필드 | 타입 | 설명 |
|---|---|---|
| `ok` | bool | 성공 여부 |
| `file_name` | string | 파일명 |
| `device` | string | 추론 디바이스 |
| `selected_engine_id` / `resolved_engine_id` | string | 엔진 ID |
| `selected_engine_name` / `resolved_engine_name` | string | 엔진명 |
| `detected_form_type` | string | 감지된 서식("신형"/"구형") |
| `preprocessed_text` | string | 전처리 텍스트 |
| `predicted_type` | string | 예측 유형("유형1"~"유형4") |
| `predicted_display` | string | 표시용 유형(예: "유형2 (임계값 미달)") |
| `predicted_description` | string | 유형 설명(§5.3) |
| `confidence` | float | 신뢰도(0~1) |
| `probabilities` | object | 유형별 확률 `{ "유형1": 0.05, ... }` |
| `evidence_sentences` | array | 근거 문장 목록 |
| `settings_used` | object | 사용된 설정값 |

`evidence_sentences[]` 항목: `{ "sentence": string, "best_type": string, "score": float }`

```json
{
  "ok": true,
  "file_name": "계약서.pdf",
  "device": "cuda:0",
  "selected_engine_id": "kogl_integrated",
  "resolved_engine_id": "kogl_integrated",
  "resolved_engine_name": "KOGL 통합 엔진",
  "detected_form_type": "신형",
  "predicted_type": "유형1",
  "predicted_display": "유형1",
  "predicted_description": "출처표시",
  "confidence": 1.0,
  "probabilities": { "유형1": 0.98, "유형2": 0.01, "유형3": 0.005, "유형4": 0.005 },
  "evidence_sentences": [
    { "sentence": "이용자는 출처를 표시하여야 한다.", "best_type": "유형1", "score": 0.92 }
  ],
  "settings_used": { "prediction_threshold": 0.55, "evidence_threshold": 0.30, "auto_detect_form": true }
}
```

> **참고**: HMC 근거 문장에는 `best_type`, `score`가 포함되며, 권리추정 API의 근거(`evidence`)와 필드 구조가 다르다.

#### 3.2.2 부가 엔드포인트

- `GET /api/health` → `{ "ok": bool, "device": string, "engines": [{ "id", "name", "valid" }] }`
- `GET /api/engines` → `{ "ok": bool, "selected_engine_id": string, "engines": [{ "id", "name", "valid", "form_type" }] }`

---

### 3.3 OCR·메타데이터 추출 API (숭실대)

파일(PDF/이미지)에서 OCR 텍스트와 메타데이터를 추출한다. LLM 추출 + NER + 통합 검증(consolidation) 결과를 함께 제공한다.

- **Base URL**: `NEXT_PUBLIC_SSU_API_URL`
- **Content-Type**: `multipart/form-data`

#### 3.3.1 `POST /api/llm-extract` (메인)

**요청 (form-data)**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
|---|---|:---:|---|---|
| `file` | file | ✅ | — | PDF/이미지 파일 |
| `document_type` | string | | "기타문서" | 문서 유형(§5.4) |
| `consolidate` | bool | | true | LLM+NER 통합 검증 수행 |
| `model_name` | string | | "Qwen3-VL-235B" | LLM 모델 |
| `ocr_provider` | string | | "alibaba" | OCR 제공자 |
| `ocr_model` | string | | "qwen3-vl-235b-a22b-instruct" | OCR 모델 |
| `ner_model` | string | | "klue-roberta-large" | NER 모델 |
| `consolidation_model` | string | | "alibaba-qwen3-next-80b-a3b-instruct" | 통합 검증 모델 |
| `stream` | bool | | false | 스트리밍 여부 |

**응답 (주요 필드)**

| 필드 | 타입 | 설명 |
|---|---|---|
| `success` | bool | 성공 여부 |
| `request_id` | string | 요청 식별자(다운로드에 사용) |
| `filename` | string | 파일명 |
| `document_type` | string | 문서 유형 |
| `metadata` | object | LLM 단독 추출 결과(문서 유형별 구조 상이) |
| `ocr_text` | string | **OCR 전체 텍스트** (유형·권리 API 입력으로 사용) |
| `ocr_provider` / `ocr_model` | string | OCR 엔진 정보 |
| `entities` | object | NER 엔티티 카운트 `{ "NAME": 2, ... }` |
| `entity_count` | int | 엔티티 총수 |
| `consolidated_metadata` | object | **통합 검증 최종 메타데이터** (화면 표시에 우선 사용) |
| `consolidation_decisions` | array | 필드별 판정 근거 |
| `consolidation_summary` | object | 통합 요약 통계 |
| `consolidation_confidence` | float | 통합 신뢰도(0~1) |
| `processing_time` | float | 처리 시간(초) |

> **메타데이터 구조는 문서 유형에 따라 다르다.** `metadata`/`consolidated_metadata`는 고정 스키마가 아닌 `key-value` 맵이며, 본 서비스는 이를 동적으로 렌더링한다. 저작물 파일의 메타데이터는 §6의 20항목으로 매핑한다.

```json
{
  "success": true,
  "request_id": "req_20260719_001",
  "filename": "계약서.pdf",
  "document_type": "계약서",
  "metadata": { "contract_type": "콘텐츠 저작재산권 양도계약서", "work_title": "2026 문화유산 디지털 아카이브", "rights_holder": "한국문화정보원" },
  "ocr_text": "콘텐츠 저작재산권 양도계약서 ...",
  "ocr_provider": "alibaba",
  "ocr_model": "qwen3-vl-235b-a22b-instruct",
  "entities": { "NAME": 2, "COMPANY": 1, "DATE": 1 },
  "entity_count": 4,
  "consolidated_metadata": { "contract_type": "콘텐츠 저작재산권 양도계약서", "work_title": "2026 문화유산 디지털 아카이브" },
  "consolidation_summary": { "total_fields": 12, "agreed_fields": 8, "conflicted_fields": 1, "llm_only_fields": 2, "ner_only_fields": 0, "missing_fields": 1, "overall_confidence": 0.87 },
  "consolidation_confidence": 0.87,
  "processing_time": 14.2
}
```

#### 3.3.2 부가 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/ocr-universal` | POST(form-data: `file`, `provider`) | OCR만 수행 → `extracted_text`, `pages[]` |
| `/api/ner-extract` | POST(form-data: `file`, `model`) | NER만 수행 → `entities`, `entity_count` |
| `/download/{request_id}?type=entities\|metadata` | GET | 결과 파일 다운로드 |
| `/health` | GET | 상태 확인 |

---

## 4. 앱 내부 라우트

프론트엔드가 벤더 API를 오케스트레이션하는 서버 라우트. 파일은 Supabase Storage에서 다운로드하며, 결과는 `rights_checks` 테이블에 저장한다.

### 4.1 `POST /api/rights/process` (권리추정)

**요청**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:---:|---|
| `rightsCheckId` | string | ✅ | `rights_checks` 레코드 ID(사전 생성) |
| `text` | string | | 계약서 본문(직접 입력 시). 있으면 SSU 생략 |
| `fileUrl` | string | | Supabase Storage 파일 URL(파일 업로드 시) |
| `fileName` | string | | 파일명 |
| `documentType` | string | | 문서 유형(§5.4) |

**처리 흐름**: (텍스트 직접 입력 시) 권리추정 즉시 실행 / (파일 시) 파일 다운로드 → SSU `/api/llm-extract` → 권리추정 `/api/v1/rights/predict` → 저장.

**응답**: `{ "success": true, "rightsCheckId": "...", "status": "completed" }` / 실패 시 `{ "error": "..." }` + 레코드 `status="failed"`.

### 4.2 `POST /api/combined/process` (통합검사)

**요청**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:---:|---|
| `rightsCheckId` | string | ✅ | `rights_checks` 레코드 ID(사전 생성, `model_info.mode="combined"`) |
| `contractFileUrl` | string | ✅ | 계약서 파일 URL |
| `contractFileName` | string | | 계약서 파일명 |
| `workFiles` | array | | 저작물 파일 목록 `[{ "url": string, "name": string }]` |
| `documentType` | string | | 문서 유형(기본 "계약서") |

**처리 흐름**:
1. 계약서: SSU `/api/llm-extract` → `ocr_text` + `contract` 메타데이터
2. 저작물 각각: SSU `/api/llm-extract` → §6 20항목 매핑 → `works[]`
3. 공공누리 유형: HMC `/api/predict`
4. 권리 판정: 권리추정 `/api/v1/rights/predict`
5. 저장: `contract_metadata = { contract, works }`, `model_info = { ...권리모델, mode:"combined", type: <HMC결과> }`

**응답**: `{ "success": true, "rightsCheckId": "...", "status": "completed", "works": <저작물 수> }`

> 유형(HMC) 실패는 치명적이지 않으며(권리 결과는 저장), 계약서 SSU 또는 권리추정 실패 시 `status="failed"`.

### 4.3 파이프라인 상태 흐름

```
uploaded → ocr_processing → predicting → completed
                                        ↘ failed
```

| 상태 | 의미 |
|---|---|
| `uploaded` | 업로드 완료, 처리 대기 |
| `ocr_processing` | SSU OCR·메타데이터 추출 중 |
| `predicting` | 유형·권리 모델 분석 중 |
| `completed` | 완료 |
| `failed` | 실패 |

---

## 5. 열거형 참조

### 5.1 권리 항목(authority) 및 그룹

| authority | 한글명 | group | 가능 상태 |
|---|---|---|---|
| `RIGHT_REPRODUCTION` | 복제권 | 저작재산권 | UNKNOWN/ALLOW/PROHIBIT |
| `RIGHT_PERFORMANCE` | 공연권 | 저작재산권 | UNKNOWN/ALLOW/PROHIBIT |
| `RIGHT_PUBLIC_TRANSMISSION` | 공중송신권 | 저작재산권 | UNKNOWN/ALLOW/PROHIBIT |
| `RIGHT_EXHIBITION` | 전시권 | 저작재산권 | UNKNOWN/ALLOW/PROHIBIT |
| `RIGHT_DISTRIBUTION` | 배포권 | 저작재산권 | UNKNOWN/ALLOW/PROHIBIT |
| `RIGHT_RENTAL` | 대여권 | 저작재산권 | UNKNOWN/ALLOW/PROHIBIT |
| `DERIVATIVE_MODIFICATION` | 변경·가공/2차적저작물작성 | 이용조건 | UNKNOWN/ALLOW/PROHIBIT |
| `ATTRIBUTION_REQUIRED` | 출처표시 | 이용조건 | ALLOW/PROHIBIT (기본 ALLOW) |
| `COMMERCIAL_USE` | 상업적 이용 | 이용조건 | UNKNOWN/ALLOW/PROHIBIT |
| `RIGHT_TRANSFER` | 권리양도 | 계약성격 | UNKNOWN/ALLOW/PROHIBIT |
| `LICENSE_GRANT` | 이용허락 | 계약성격 | UNKNOWN/ALLOW/PROHIBIT |
| `EXCLUSIVITY` | 독점성 | 계약성격 | UNKNOWN/ALLOW/PROHIBIT |
| `SUBLICENSE` | 재허락 | 계약성격 | UNKNOWN/ALLOW/PROHIBIT |
| `TERRITORY_SCOPE` | 이용지역 | 이용범위 | UNKNOWN/KOREA/WORLDWIDE/LIMITED/UNRESTRICTED |
| `TERM_SCOPE` | 이용기간 | 이용범위 | UNKNOWN/PERPETUAL/FIXED/UNSPECIFIED |
| `PAYMENT_TYPE` | 대가조건 | 대가조건 | UNKNOWN/ROYALTY/LUMP_SUM/FREE |

그룹 표시 순서: `저작재산권 → 이용조건 → 계약성격 → 이용범위 → 대가조건 → 기타`

### 5.2 판정 상태(status) 한글 표기

| status | 한글 | status | 한글 |
|---|---|---|---|
| `UNKNOWN` | (미식별) | `PERPETUAL` | 영구 |
| `ALLOW` | 허용 | `FIXED` | 기간제한 |
| `PROHIBIT` | 금지 | `UNSPECIFIED` | 기간미정 |
| `KOREA` | 국내 | `ROYALTY` | 로열티 |
| `WORLDWIDE` | 전세계 | `LUMP_SUM` | 일시금 |
| `LIMITED` | 제한 | `FREE` | 무상 |
| `UNRESTRICTED` | 제한없음 | | |

### 5.3 공공누리 유형

| 코드 | 표시 | 설명 |
|---|---|---|
| 유형1 | 제1유형 | 출처표시 |
| 유형2 | 제2유형 | 출처표시 + 상업적 이용금지 |
| 유형3 | 제3유형 | 출처표시 + 변경금지 |
| 유형4 | 제4유형 | 출처표시 + 상업적 이용금지 + 변경금지 |

### 5.4 문서 유형(document_type)

`계약서`, `동의서`, `저작재산권 양도동의서`, `공공저작물 자유이용허락 동의서`, `기타문서`

---

## 6. 저작물 메타데이터 20항목 매핑

통합검사에서 각 저작물 파일의 SSU 추출 결과를 아래 20항목으로 매핑한다. SSU 응답 필드명은 문서 유형별로 다를 수 있어 **여러 후보 필드**에서 값을 찾는다.

| 항목(한글) | 매핑 키 | SSU 후보 필드 |
|---|---|---|
| 저작물명 | `work_name` | work_title, work_name, copyright_kotitle |
| 유형 | `work_type` | (별도 enum 매핑) |
| 디지털화형태 | `digital_format` | digital_format, copyright_status |
| 설명 | `description` | description, copyright_explain |
| 주제어 | `keywords` | keyword, keywords |
| 언어 | `language` | language |
| 제작일 | `created_date` | created_date, production_date, copyright_date, consent_date |
| 제작자 | `creator` | copyright_holder, rights_holder, ch_co_name |
| 저작권자 | `copyright_holder` | copyright_holder, rights_holder, ch_co_name, data_controller |
| 공동저작자 | `co_authors` | co_author, co_authors, ch_ja_name |
| 저작인접권자 | `neighboring_rights_holder` | neighboring_rights_holder, ch_nr_name |
| 공개유형 | `disclosure_type` | disclosure_type, kogl_type, ri_info |
| 저작물성 | `copyrightability` | copyrightability |
| 비보호저작물 | `non_protected_work` | non_protected_work, unprotected_work |
| 업무상저작물 | `work_for_hire` | work_for_hire |
| 상업적이용허락 | `commercial_use` | commercial_use, granted_rights |
| 저작재산권 | `property_rights` | property_rights, economic_rights, ri_copyright |
| 공동저작자동의 | `co_author_consent` | co_author_consent, consent_status |
| 유효기간 | `validity_period` | validity_period, valid_period, ri_period, retention_period |
| 초상권 | `portrait_rights` | portrait_rights |

> `계약서 추출 정보`(계약서 단위) 화면에서 `work_title`/`work_names` 필드는 **"계약 제목"** 으로 표기한다(개별 저작물명과 구분).

---

## 7. 검증 기준(요약)

연동 개발사는 아래를 만족해야 한다.

1. **권리추정 API**: §3.1의 요청으로 호출 시, 응답이 §3.1의 필드 구조(특히 `rights_results[]` 9필드, `evidence[]` 8필드)와 정확히 일치할 것.
2. **유형분류 API**: §3.2의 요청으로 호출 시, `predicted_type`이 "유형1"~"유형4" 중 하나이고 `evidence_sentences[]`가 `{sentence, best_type, score}` 구조일 것.
3. **OCR·메타 API**: §3.3의 form-data로 호출 시, `ocr_text`(문자열)와 `consolidated_metadata`(맵)를 반환할 것.
4. **표시값 일치**: 모든 화면 표시값은 API 응답값과 동일해야 하며, 임의 추정/가공 금지.
```
