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
// HMC API 타입 (실제 스펙 반영 - POST /api/predict)
// ========================================

// 요청
export interface HMCPredictRequest {
  text: string                          // 계약서 OCR 텍스트 (필수)
  engine_id?: string                    // 엔진 ID
  file_name?: string                    // 파일명
  strip_article_titles?: boolean        // 조항 제목 제거 (기본: true)
  normalize_whitespace?: boolean        // 공백 정규화 (기본: true)
  remove_page_artifacts?: boolean       // 페이지 아티팩트 제거 (기본: true)
  prediction_threshold?: number         // 예측 임계값 (기본: 0.55)
  evidence_threshold?: number           // 근거 임계값 (기본: 0.30)
  max_evidence_sentences?: number       // 최대 근거 문장 수 (기본: 10)
  auto_detect_form?: boolean            // 신형/구형 자동 감지 (기본: true)
  max_length?: number                   // 최대 토큰 길이 (기본: 512)
}

// 응답
export interface HMCPredictResponse {
  ok: boolean
  file_name: string
  device: string
  selected_engine_id: string
  selected_engine_name: string
  resolved_engine_id: string
  resolved_engine_name: string
  resolved_model_dir: string
  detected_form_type: string            // "신형" | "구형"
  preprocessed_text: string
  predicted_type: string                // "유형1" ~ "유형4"
  predicted_display: string             // "유형2" 또는 "유형2 (임계값 미달)"
  predicted_description: string         // "출처표시 + 비영리 + 변경허용"
  confidence: number
  probabilities: Record<string, number> // { "유형1": 0.05, "유형2": 0.81, ... }
  evidence_sentences: HMCEvidenceSentence[]
  settings_used: Record<string, unknown>
  settings_path: string
}

// 근거 문장
export interface HMCEvidenceSentence {
  sentence: string                      // 근거 문장 원문
  best_type: string                     // "유형2" 등
  score: number                         // 점수 (0~1)
}

// 하위 호환용 별칭
export type HMCClassifyResponse = HMCPredictResponse
export type HMCEvidenceClause = HMCEvidenceSentence
