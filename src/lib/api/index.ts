// ========================================
// API 어댑터 통합 진입점
// ========================================
// 사용법:
//   import { extractMetadata, classifyKoglType } from "@/lib/api"
//
// 연동 방법:
//   .env.local에 아래 환경변수 설정 시 자동으로 실제 API 호출
//   NEXT_PUBLIC_SSU_API_URL=http://숭실대서버:포트
//   NEXT_PUBLIC_HMC_API_URL=http://HMC서버:포트
//
//   환경변수 미설정 시 Mock 데이터로 동작
// ========================================

export { API_CONFIG, DOCUMENT_TYPES } from "./config"
export type { DocumentType } from "./config"

// 숭실대 API
export {
  extractMetadata,
  extractOcrOnly,
  extractNerOnly,
  downloadResult,
  checkHealth,
  mapSSUMetadataToDisplay,
} from "./ocr"

// HMC API
export { classifyKoglType, mapHMCToKoglType, mapHMCToContractClauses } from "./classifier"

// 타입
export type {
  SSUExtractRequest,
  SSUExtractResponse,
  SSUConsolidationDecision,
  SSUConsolidationSummary,
  SSUOcrResponse,
  SSUOcrPage,
  SSUNerResponse,
  SSUDownloadParams,
  SSUHealthResponse,
  SSUErrorResponse,
  HMCClassifyResponse,
  HMCEvidenceClause,
} from "./types"
