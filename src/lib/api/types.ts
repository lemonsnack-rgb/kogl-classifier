// ========================================
// 숭실대 API 응답 타입 (원본 그대로)
// ========================================

// POST /api/llm-extract 응답
export interface SSUExtractResponse {
  success: boolean
  request_id: string
  filename: string
  document_type: string

  // LLM 단독 추출 결과
  metadata: SSUMetadata
  confidence: number

  // OCR 결과
  ocr_text: string
  ocr_provider: string
  ocr_model: string

  // NER 결과
  ner_model: string
  entities: Record<string, number>
  entity_count: number

  // 통합 검증 결과 (최종)
  consolidated_metadata: SSUMetadata
  consolidation_decisions: SSUConsolidationDecision[]
  consolidation_summary: SSUConsolidationSummary

  processing_time: number
}

// 메타데이터 구조 (필수 20개 항목 기준)
export interface SSUMetadata {
  // 저작물 정보
  work_name?: string | null // 저작물명
  work_type?: string | null // 저작물 유형
  digital_format?: string | null // 디지털화 형태
  description?: string | null // 저작물 설명
  keywords?: string | null // 주제어
  language?: string | null // 언어
  created_date?: string | null // 제작일
  contract_type?: string | null // 계약서 유형

  // 저작자 정보
  copyright_holder?: string | null // 저작권자
  co_authors?: string | null // 공동저작자
  neighboring_rights_holder?: string | null // 저작인접권자

  // 권리 정보
  disclosure_type?: string | null // 공개유형
  copyrightability?: string | null // 저작물성
  non_protected_work?: string | null // 비보호저작물
  work_for_hire?: string | null // 업무상저작물
  commercial_use?: string | null // 상업적 이용허락
  property_rights?: string | null // 저작재산권
  co_author_consent?: string | null // 공동저작자 동의
  validity_period?: string | null // 유효기간
  portrait_rights?: string | null // 초상권

  // 확장 필드 (향후 추가 가능)
  [key: string]: string | null | undefined
}

// 통합 검증 판정
export interface SSUConsolidationDecision {
  field: string
  llm_value: string | null
  ner_value: string | null
  final_value: string | null
  decision: "AGREED" | "CONFLICT" | "LLM_ONLY" | "NER_ONLY" | "MISSING"
  confidence: number
  reasoning: string
}

// 통합 검증 요약
export interface SSUConsolidationSummary {
  total_fields: number
  agreed_fields: number
  conflicted_fields: number
  llm_only_fields: number
  ner_only_fields: number
  missing_fields: number
  overall_confidence: number
}

// POST /api/ocr-universal 응답
export interface SSUOcrResponse {
  success: boolean
  request_id: string
  filename: string
  full_text: string
  pages: SSUOcrPage[]
  processing_time: number
}

export interface SSUOcrPage {
  page_number: number
  extracted_text: string
  text_length: number
  status: string
}

// GET /health 응답
export interface SSUHealthResponse {
  status: string
  available_ocr_engines: string[]
  available_models: string[]
}

// ========================================
// HMC API 응답 타입 (예상 - 스펙 수신 후 수정)
// ========================================

export interface HMCClassifyResponse {
  success: boolean
  request_id: string
  // 분류 결과
  kogl_type: 1 | 2 | 3 | 4
  confidence: number
  // 판단 근거 조항
  evidence_clauses: HMCEvidenceClause[]
  // 정책 제약
  policy_constraints?: {
    commercial_use: boolean
    derivative_work: boolean
    territory: string
    term: string
  }
}

export interface HMCEvidenceClause {
  clause_type: string // OWNERSHIP, LICENSE, DERIVATIVE, SCOPE, TERM, ATTRIBUTION
  text: string // 계약서 원문 문구
  page_number?: number
  confidence: number
}
