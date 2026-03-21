// ========================================
// 숭실대 API 응답 타입 (2.API_명세서.docx 기준)
// ========================================

// POST /api/llm-extract 요청 파라미터
export interface SSUExtractRequest {
  file: File // (필수) PDF/이미지 파일
  model_name?: string // 기본값: "Qwen3-VL-235B"
  document_type?: string // 기본값: "기타문서" (계약서, 동의서, 저작재산권 양도동의서, 공공저작물 자유이용허락 동의서, 기타문서)
  ocr_provider?: string // 기본값: "alibaba"
  ocr_model?: string // 기본값: "qwen3-vl-235b-a22b-instruct"
  ner_model?: string // 기본값: "klue-roberta-large"
  consolidate?: boolean // 기본값: true
  consolidation_model?: string // 기본값: "alibaba-qwen3-next-80b-a3b-instruct"
  stream?: boolean // 기본값: false
}

// POST /api/llm-extract 응답
export interface SSUExtractResponse {
  success: boolean
  request_id: string
  filename: string
  file_size_mb: number
  model_used: string
  document_type: string

  // LLM 단독 추출 결과 (문서 유형별 구조가 다름)
  metadata: Record<string, unknown>
  confidence: number
  extraction_time: number

  // OCR 결과
  ocr_text: string
  ocr_provider: string
  ocr_model: string

  // NER 결과
  ner_model: string
  entities: Record<string, number>
  entity_count: number
  ner_success: boolean

  // 통합 검증 결과 (최종)
  consolidate: boolean
  consolidation_success: boolean
  consolidated_metadata: Record<string, unknown>
  consolidation_decisions: SSUConsolidationDecision[]
  consolidation_summary: SSUConsolidationSummary
  consolidation_confidence: number
  consolidation_model_used: string
  consolidation_fallback_used: boolean

  processing_time: number

  // 에러 필드 (실제 API 응답에 포함될 수 있음)
  error?: string
  ner_error?: string
  ner_model_key?: string
  consolidation_error?: string
  consolidation_model?: string
}

// 통합 검증 판정 (필드별)
export interface SSUConsolidationDecision {
  field: string
  llm_value: unknown
  ner_value: unknown
  final_value: unknown
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

// ========================================
// POST /api/ocr-universal 응답
// ========================================
export interface SSUOcrResponse {
  request_id: string
  filename: string
  provider: string
  model: string
  success: boolean
  total_pages: number
  total_text_length: number
  processing_time: number
  extracted_text: string
  pages: SSUOcrPage[]
}

export interface SSUOcrPage {
  page_number: number
  extracted_text: string
  text_length: number
  status: string
}

// ========================================
// POST /api/ner-extract 응답
// ========================================
export interface SSUNerResponse {
  success: boolean
  request_id: string
  filename: string
  file_size_mb: number
  model: string
  entities: Record<string, number>
  entity_count: number
  steps: {
    ocr: { success: boolean; time: number }
    ner: { success: boolean; entity_count: number; time: number }
  }
  processing_time: number
}

// ========================================
// GET /download/{request_id} 응답
// ========================================
export interface SSUDownloadParams {
  request_id: string
  type: "entities" | "metadata"
}

// ========================================
// GET /health 응답
// ========================================
export interface SSUHealthResponse {
  status: string
  timestamp: string
  available_ocr_engines: Record<string, boolean>
  available_models: Record<string, unknown>
}

// ========================================
// 에러 응답 (모든 엔드포인트 공통)
// ========================================
export interface SSUErrorResponse {
  success: false
  error: string
  request_id: string
}

// ========================================
// 메타데이터 구조 참고 (문서 유형별로 다름)
// ========================================
// 동의서 응답 예시:
// {
//   "consent_type": "개인정보 수집 및 이용 동의서",
//   "data_controller": "주) 나라지식정보",
//   "data_subject": "박광수",
//   "collection_purpose": "...",
//   "collected_data_types": ["성명", "전화번호", "주소"],
//   "retention_period": "...",
//   "third_party_sharing": { "recipient": "...", "purpose": "...", "data_types": [...] },
//   "consent_status": "동의함",
//   "consent_date": "2020-06-20",
//   "signature": "박광수",
//   "contact_info": { "phone": "...", "address": "...", "email": null },
//   "parties": [{ "name": "...", "phone": "...", "address": "...", "role": "..." }]
// }
//
// 메타데이터는 Record<string, unknown>으로 수신하여
// 프론트엔드에서 키-값을 동적으로 렌더링합니다.

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
  clause_type: string
  text: string
  page_number?: number
  confidence: number
}
