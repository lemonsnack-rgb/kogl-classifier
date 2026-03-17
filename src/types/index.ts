// ========================================
// 공공저작물 권리유형 자동분류 서비스 - 타입 정의
// ========================================

// KOGL 유형
export type KoglType = "KOGL-1" | "KOGL-2" | "KOGL-3" | "KOGL-4"

// 처리 상태
export type ContractStatus =
  | "uploaded"
  | "ocr_processing"
  | "classifying"
  | "review_required"
  | "completed"
  | "failed"

// 분류 판정 근거
export type ClassificationBasis = "CONTRACT" | "AI" | "MANUAL"

// 예외 유형
export type ExceptionType =
  | "NO_CONTRACT"
  | "LOW_OCR_QUALITY"
  | "NO_CLAUSE_MATCH"
  | "FORMAT_UNSUPPORTED"
  | "LEGACY_VENDOR"

// 조항 유형
export type ClauseType =
  | "OWNERSHIP"
  | "LICENSE"
  | "DERIVATIVE"
  | "SCOPE"
  | "TERM"
  | "ATTRIBUTION"

// 저작물 유형
export type WorkType = "image" | "text" | "audio" | "video"

// OCR 상태
export type OcrStatus = "pending" | "completed" | "failed"

// 사용자 역할
export type UserRole = "admin" | "user"

// ========================================
// 프로필
// ========================================
export interface Profile {
  id: string
  email: string
  name: string | null
  organization: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

// ========================================
// 계약서 (처리 단위)
// ========================================
export interface Contract {
  id: string
  user_id: string
  contract_file_url: string | null
  contract_filename: string | null
  inspection_title: string | null
  is_institution_made: boolean
  gongnuri_type: KoglType | null
  gongnuri_confidence: number | null
  gongnuri_top_k: TopKItem[] | null
  classification_basis: ClassificationBasis | null
  policy_constraints: PolicyConstraints | null
  status: ContractStatus
  exception_type: ExceptionType | null
  is_edited: boolean
  edited_by: string | null
  edited_at: string | null
  edit_reason: string | null
  ocr_text: string | null
  created_at: string
  updated_at: string
  // 조인된 데이터
  works?: Work[]
  clauses?: ContractClause[]
  profile?: Profile
  works_count?: number
}

export interface TopKItem {
  label: string
  score: number
}

export interface PolicyConstraints {
  commercialUse: boolean
  territory: string
  term: string
}

// ========================================
// 계약서 조항 (판단 근거)
// ========================================
export interface ContractClause {
  id: string
  contract_id: string
  clause_type: ClauseType
  clause_text: string
  match_score: number
  page_number: number | null
  char_start: number | null
  char_end: number | null
  template_id: string | null
  created_at: string
}

// ========================================
// 저작물
// ========================================
export interface Work {
  id: string
  contract_id: string
  work_file_url: string | null
  work_filename: string
  ocr_text: string | null
  ocr_status: OcrStatus
  // 저작물 정보 메타데이터
  work_name: string | null
  work_type: WorkType | null
  digital_format: string | null
  description: string | null
  keywords: string[] | null
  language: string | null
  created_date: string | null
  creator: string | null
  // 권리정보 메타데이터
  copyright_period: string | null
  usage_scope: string | null
  usage_territory: string | null
  // 계약서 추출 NER 메타데이터
  contract_metadata: ContractNerMetadata | null
  is_metadata_edited: boolean
  metadata_edited_by: string | null
  metadata_edited_at: string | null
  created_at: string
  updated_at: string
}

export interface ContractNerMetadata {
  assignee_org: string | null // 양수자 기관명
  assignee_address: string | null // 양수자 주소
  assignor_name: string | null // 양도자 기관/개인명
  assignor_affiliation: string | null // 양도자 소속
  assignor_address: string | null // 양도자 대표주소
  assignor_contact: string | null // 양도자 연락처
  consent_status: string | null // 동의여부
  consent_date: string | null // 날짜
}

// ========================================
// 초대
// ========================================
export interface Invitation {
  id: string
  email: string
  invited_by: string
  role: UserRole
  status: "pending" | "accepted"
  created_at: string
}

// ========================================
// 수정 이력
// ========================================
export interface EditHistory {
  id: string
  target_type: "contract" | "work"
  target_id: string
  field_name: string
  old_value: string | null
  new_value: string | null
  edited_by: string
  edited_at: string
  reason: string | null
}

// ========================================
// KOGL 유형 메타 정보
// ========================================
export const KOGL_TYPES: Record<
  KoglType,
  { label: string; description: string; color: string }
> = {
  "KOGL-1": {
    label: "제1유형",
    description: "출처표시",
    color: "#00845A",
  },
  "KOGL-2": {
    label: "제2유형",
    description: "출처표시 + 상업적 이용금지",
    color: "#2563EB",
  },
  "KOGL-3": {
    label: "제3유형",
    description: "출처표시 + 변경금지",
    color: "#D97706",
  },
  "KOGL-4": {
    label: "제4유형",
    description: "출처표시 + 상업적 이용금지 + 변경금지",
    color: "#DC2626",
  },
}

// 상태 메타 정보
export const STATUS_META: Record<
  ContractStatus,
  { label: string; color: string }
> = {
  uploaded: { label: "검사중", color: "#3B82F6" },
  ocr_processing: { label: "검사중", color: "#3B82F6" },
  classifying: { label: "검사중", color: "#3B82F6" },
  review_required: { label: "검사대기", color: "#F59E0B" },
  completed: { label: "검사완료", color: "#10B981" },
  failed: { label: "검사불가", color: "#EF4444" },
}
