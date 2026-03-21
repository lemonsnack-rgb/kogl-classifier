// ========================================
// 숭실대 OCR + 메타데이터 추출 어댑터
// ========================================
// 연동 방법: .env.local에 NEXT_PUBLIC_SSU_API_URL 설정하면 자동 전환
// 예: NEXT_PUBLIC_SSU_API_URL=http://xxx.xxx.xxx.xxx:8000

import { API_CONFIG, type DocumentType } from "./config"
import type {
  SSUExtractResponse,
  SSUOcrResponse,
  SSUNerResponse,
  SSUHealthResponse,
} from "./types"

// ========================================
// 1. 통합 추출 (메인) - POST /api/llm-extract
// ========================================
export async function extractMetadata(
  file: File,
  documentType: DocumentType = "기타문서",
  options?: {
    ocrProvider?: string
    ocrModel?: string
    nerModel?: string
    consolidate?: boolean
    stream?: boolean
  }
): Promise<SSUExtractResponse> {
  if (API_CONFIG.useMockSSU) {
    return getMockExtractResponse(file.name, documentType)
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("document_type", documentType)
  formData.append("consolidate", String(options?.consolidate ?? true))
  if (options?.ocrProvider) formData.append("ocr_provider", options.ocrProvider)
  if (options?.ocrModel) formData.append("ocr_model", options.ocrModel)
  if (options?.nerModel) formData.append("ner_model", options.nerModel)

  const response = await fetch(
    `${API_CONFIG.SSU_API_BASE_URL}/api/llm-extract`,
    {
      method: "POST",
      body: formData,
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(
      errorData?.error || `숭실대 API 오류: ${response.status} ${response.statusText}`
    )
  }

  return response.json()
}

// ========================================
// 2. OCR만 추출 - POST /api/ocr-universal
// ========================================
export async function extractOcrOnly(
  file: File,
  provider: string = "alibaba"
): Promise<SSUOcrResponse> {
  if (API_CONFIG.useMockSSU) {
    return {
      request_id: `mock_${Date.now()}`,
      filename: file.name,
      provider,
      model: "mock",
      success: true,
      total_pages: 1,
      total_text_length: 0,
      processing_time: 0,
      extracted_text: "(Mock) OCR 텍스트",
      pages: [{ page_number: 1, extracted_text: "(Mock) OCR 텍스트", text_length: 0, status: "success" }],
    }
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("provider", provider)

  const response = await fetch(
    `${API_CONFIG.SSU_API_BASE_URL}/api/ocr-universal`,
    { method: "POST", body: formData }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.error || `OCR API 오류: ${response.status}`)
  }

  return response.json()
}

// ========================================
// 3. NER만 추출 - POST /api/ner-extract
// ========================================
export async function extractNerOnly(
  file: File,
  model: string = "klue-roberta-large"
): Promise<SSUNerResponse> {
  if (API_CONFIG.useMockSSU) {
    return {
      success: true,
      request_id: `mock_${Date.now()}`,
      filename: file.name,
      file_size_mb: 0,
      model,
      entities: {},
      entity_count: 0,
      steps: {
        ocr: { success: true, time: 0 },
        ner: { success: true, entity_count: 0, time: 0 },
      },
      processing_time: 0,
    }
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("model", model)

  const response = await fetch(
    `${API_CONFIG.SSU_API_BASE_URL}/api/ner-extract`,
    { method: "POST", body: formData }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.error || `NER API 오류: ${response.status}`)
  }

  return response.json()
}

// ========================================
// 4. 결과 다운로드 - GET /download/{request_id}
// ========================================
export async function downloadResult(
  requestId: string,
  type: "entities" | "metadata" = "metadata"
): Promise<Blob> {
  if (API_CONFIG.useMockSSU) {
    return new Blob([JSON.stringify({ mock: true })], { type: "application/json" })
  }

  const response = await fetch(
    `${API_CONFIG.SSU_API_BASE_URL}/download/${requestId}?type=${type}`
  )

  if (!response.ok) {
    throw new Error(`다운로드 실패: ${response.status}`)
  }

  return response.blob()
}

// ========================================
// 5. 서버 상태 확인 - GET /health
// ========================================
export async function checkHealth(): Promise<SSUHealthResponse> {
  if (API_CONFIG.useMockSSU) {
    return {
      status: "mock",
      timestamp: new Date().toISOString(),
      available_ocr_engines: {},
      available_models: {},
    }
  }

  const response = await fetch(`${API_CONFIG.SSU_API_BASE_URL}/health`)

  if (!response.ok) {
    throw new Error(`서버 상태 확인 실패: ${response.status}`)
  }

  return response.json()
}

// ========================================
// 숭실대 응답 메타데이터 → 표시용 키-값 변환
// ========================================
export function mapSSUMetadataToDisplay(
  metadata: Record<string, unknown>
): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      result[key] = null
    } else if (typeof value === "object") {
      result[key] = JSON.stringify(value, null, 2)
    } else {
      result[key] = String(value)
    }
  }
  return result
}

// ========================================
// 숭실대 consolidated_metadata → Work 20개 항목 매핑
// ========================================
// 숭실대 API 응답 필드명은 문서 유형별로 다를 수 있으므로
// 여러 후보 필드에서 값을 찾아 매핑합니다.
export function mapSSUToWorkFields(
  meta: Record<string, unknown>
): Partial<import("@/types").Work> {
  const str = (keys: string[]): string | null => {
    for (const k of keys) {
      const v = meta[k]
      if (v !== null && v !== undefined) {
        return typeof v === "object" ? JSON.stringify(v) : String(v)
      }
    }
    return null
  }

  return {
    // ── 저작물 정보 (8항목) ──
    work_name: str(["work_title", "work_name", "copyright_kotitle"]),
    work_type: null, // work_type은 enum이라 별도 매핑 필요
    digital_format: str(["digital_format", "copyright_status"]),
    description: str(["description", "copyright_explain"]),
    keywords: meta.keyword ? [String(meta.keyword)] : meta.keywords ? [String(meta.keywords)] : null,
    language: str(["language"]),
    created_date: str(["created_date", "production_date", "copyright_date", "consent_date"]),
    creator: str(["copyright_holder", "rights_holder", "ch_co_name"]),

    // ── 저작자 정보 (3항목) ──
    copyright_holder: str(["copyright_holder", "rights_holder", "ch_co_name", "data_controller"]),
    co_authors: str(["co_author", "co_authors", "ch_ja_name"]),
    neighboring_rights_holder: str(["neighboring_rights_holder", "ch_nr_name"]),

    // ── 권리 정보 (9항목) ──
    disclosure_type: str(["disclosure_type", "kogl_type", "ri_info"]),
    copyrightability: str(["copyrightability"]),
    non_protected_work: str(["non_protected_work", "unprotected_work"]),
    work_for_hire: str(["work_for_hire"]),
    commercial_use: str(["commercial_use", "granted_rights"]),
    property_rights: str(["property_rights", "economic_rights", "ri_copyright"]),
    co_author_consent: str(["co_author_consent", "consent_status"]),
    validity_period: str(["validity_period", "valid_period", "ri_period", "retention_period"]),
    portrait_rights: str(["portrait_rights"]),

    // 기존 호환
    copyright_period: str(["validity_period", "valid_period", "ri_period"]),
    usage_scope: str(["commercial_use", "granted_rights"]),
  }
}

// ========================================
// Mock 데이터 (API 미연결 시 사용)
// ========================================
function getMockExtractResponse(
  filename: string,
  documentType: string
): SSUExtractResponse {
  return {
    success: true,
    request_id: `mock_${Date.now()}`,
    filename,
    file_size_mb: 0.35,
    model_used: "mock",
    document_type: documentType,
    metadata: {
      consent_type: "(Mock) 저작재산권 양도 동의서",
      data_controller: "(Mock) 한국문화정보원",
      data_subject: "(Mock) 홍길동",
      collection_purpose: "(Mock) 저작재산권 양도 의사표시 확인",
      collected_data_types: ["성명", "전화번호", "주소"],
      retention_period: "(Mock) 저작인접권 보호기간 만료일까지",
      consent_status: "동의함",
      consent_date: "2026-01-15",
      contact_info: { phone: "010-1234-5678", address: "서울시 중구 세종대로 110", email: null },
      parties: [
        { name: "홍길동", phone: "010-1234-5678", address: "서울시 중구", role: "양도인" },
        { name: "한국문화정보원", phone: "02-3153-2100", address: "서울시 중구 세종대로 110", role: "양수인" },
      ],
    },
    confidence: 1.0,
    extraction_time: 14.2,
    ocr_text: "(Mock) OCR 텍스트 - 실제 API 연동 시 추출됩니다.",
    ocr_provider: "mock",
    ocr_model: "mock",
    ner_model: "mock",
    entities: { NAME: 2, PHONE: 2, ADDRESS: 2, COMPANY: 1 },
    entity_count: 7,
    ner_success: true,
    consolidate: true,
    consolidation_success: true,
    consolidated_metadata: {
      consent_type: "(Mock) 저작재산권 양도 동의서",
      data_controller: "(Mock) 한국문화정보원",
      data_subject: "(Mock) 홍길동",
      collection_purpose: "(Mock) 저작재산권 양도 의사표시 확인",
      consent_status: "동의함",
      consent_date: "2026-01-15",
    },
    consolidation_decisions: [
      {
        field: "data_subject",
        llm_value: "홍길동",
        ner_value: "홍길동",
        final_value: "홍길동",
        decision: "AGREED",
        confidence: 1.0,
        reasoning: "LLM과 NER 결과 일치",
      },
      {
        field: "data_controller",
        llm_value: "한국문화정보원",
        ner_value: "한국문화정보원",
        final_value: "한국문화정보원",
        decision: "AGREED",
        confidence: 1.0,
        reasoning: "LLM과 NER 결과 일치",
      },
    ],
    consolidation_summary: {
      total_fields: 12,
      agreed_fields: 8,
      conflicted_fields: 1,
      llm_only_fields: 2,
      ner_only_fields: 0,
      missing_fields: 1,
      overall_confidence: 0.87,
    },
    consolidation_confidence: 0.87,
    consolidation_model_used: "mock",
    consolidation_fallback_used: false,
    processing_time: 0,
  }
}
