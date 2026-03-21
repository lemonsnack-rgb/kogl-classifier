// ========================================
// 숭실대 OCR + 메타데이터 추출 어댑터
// ========================================
// 연동 방법: .env.local에 NEXT_PUBLIC_SSU_API_URL 설정하면 자동 전환
// 예: NEXT_PUBLIC_SSU_API_URL=http://xxx.xxx.xxx.xxx:8000

import { API_CONFIG, type DocumentType } from "./config"
import type { SSUExtractResponse } from "./types"
import type { Work, ContractNerMetadata } from "@/types"

// ========================================
// 통합 추출 요청 (OCR + LLM + NER + 통합검증)
// ========================================
export async function extractMetadata(
  file: File,
  documentType: DocumentType = "기타문서"
): Promise<SSUExtractResponse> {
  if (API_CONFIG.useMockSSU) {
    return getMockExtractResponse(file.name, documentType)
  }

  const formData = new FormData()
  formData.append("file", file)
  formData.append("document_type", documentType)
  formData.append("consolidate", "true")

  const response = await fetch(
    `${API_CONFIG.SSU_API_BASE_URL}/api/llm-extract`,
    {
      method: "POST",
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error(`숭실대 API 오류: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// ========================================
// 숭실대 응답 → 우리 Work 타입으로 변환
// ========================================
export function mapSSUResponseToWork(
  ssuResponse: SSUExtractResponse,
  contractId: string,
  workId: string,
  fileName: string
): Partial<Work> {
  const meta = ssuResponse.consolidated_metadata || ssuResponse.metadata

  return {
    id: workId,
    contract_id: contractId,
    work_filename: fileName,
    ocr_text: ssuResponse.ocr_text,
    ocr_status: ssuResponse.success ? "completed" : "failed",

    // 저작물 정보 (20개 항목 중)
    work_name: meta.work_name || null,
    work_type: mapWorkType(meta.work_type),
    digital_format: meta.digital_format || null,
    description: meta.description || null,
    keywords: meta.keywords ? meta.keywords.split(",").map((k) => k.trim()) : null,
    language: meta.language || null,
    created_date: meta.created_date || null,
    creator: meta.copyright_holder || null,

    // 권리 정보
    copyright_period: meta.validity_period || null,
    usage_scope: meta.commercial_use || null,
    usage_territory: null,

    // NER 추출 메타데이터
    contract_metadata: mapSSUToContractNer(meta),
  }
}

// 숭실대 메타데이터 → ContractNerMetadata 변환
function mapSSUToContractNer(meta: Record<string, unknown>): ContractNerMetadata {
  return {
    assignee_org: (meta.copyright_holder as string) || null,
    assignee_address: null,
    assignor_name: (meta.co_authors as string) || null,
    assignor_affiliation: null,
    assignor_address: null,
    assignor_contact: null,
    consent_status: (meta.co_author_consent as string) || null,
    consent_date: (meta.created_date as string) || null,
  }
}

// 저작물 유형 매핑
function mapWorkType(
  ssuType: string | null | undefined
): "image" | "text" | "audio" | "video" | null {
  if (!ssuType) return null
  const lower = ssuType.toLowerCase()
  if (lower.includes("이미지") || lower.includes("사진") || lower.includes("image")) return "image"
  if (lower.includes("동영상") || lower.includes("영상") || lower.includes("video")) return "video"
  if (lower.includes("음원") || lower.includes("오디오") || lower.includes("audio")) return "audio"
  return "text"
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
    document_type: documentType,
    metadata: {
      work_name: `${filename} 추출 저작물`,
      work_type: "텍스트",
      digital_format: "PDF",
      description: "OCR 및 메타데이터 추출 대기 중",
      keywords: null,
      language: "ko",
      created_date: null,
      contract_type: documentType,
      copyright_holder: null,
      co_authors: null,
      neighboring_rights_holder: null,
      disclosure_type: null,
      copyrightability: null,
      non_protected_work: null,
      work_for_hire: null,
      commercial_use: null,
      property_rights: null,
      co_author_consent: null,
      validity_period: null,
      portrait_rights: null,
    },
    confidence: 0,
    ocr_text: "(Mock) OCR 텍스트 - 실제 API 연동 시 추출됩니다.",
    ocr_provider: "mock",
    ocr_model: "mock",
    ner_model: "mock",
    entities: {},
    entity_count: 0,
    consolidated_metadata: {
      work_name: `${filename} 추출 저작물`,
      work_type: "텍스트",
      digital_format: "PDF",
      description: "OCR 및 메타데이터 추출 대기 중",
      keywords: null,
      language: "ko",
      created_date: null,
      contract_type: documentType,
      copyright_holder: null,
      co_authors: null,
      neighboring_rights_holder: null,
      disclosure_type: null,
      copyrightability: null,
      non_protected_work: null,
      work_for_hire: null,
      commercial_use: null,
      property_rights: null,
      co_author_consent: null,
      validity_period: null,
      portrait_rights: null,
    },
    consolidation_decisions: [],
    consolidation_summary: {
      total_fields: 20,
      agreed_fields: 0,
      conflicted_fields: 0,
      llm_only_fields: 0,
      ner_only_fields: 0,
      missing_fields: 20,
      overall_confidence: 0,
    },
    processing_time: 0,
  }
}
