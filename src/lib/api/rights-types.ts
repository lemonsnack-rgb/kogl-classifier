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
