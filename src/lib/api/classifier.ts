// ========================================
// HMC 공공누리 유형 분류 어댑터
// ========================================
// 연동 방법: .env.local에 NEXT_PUBLIC_HMC_API_URL 설정하면 자동 전환
// 예: NEXT_PUBLIC_HMC_API_URL=http://xxx.xxx.xxx.xxx:8000

import { API_CONFIG } from "./config"
import type { HMCClassifyResponse, HMCEvidenceClause } from "./types"
import type { KoglType, ContractClause, ClauseType } from "@/types"

// ========================================
// 분류 요청
// ========================================
export async function classifyKoglType(
  contractFile: File,
  ocrText?: string
): Promise<HMCClassifyResponse> {
  if (API_CONFIG.useMockHMC) {
    return getMockClassifyResponse()
  }

  const formData = new FormData()
  formData.append("file", contractFile)
  if (ocrText) {
    formData.append("ocr_text", ocrText)
  }

  const response = await fetch(
    `${API_CONFIG.HMC_API_BASE_URL}/api/classify`,
    {
      method: "POST",
      body: formData,
    }
  )

  if (!response.ok) {
    throw new Error(`HMC API 오류: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// ========================================
// HMC 응답 → 우리 타입으로 변환
// ========================================
export function mapHMCToKoglType(hmcType: 1 | 2 | 3 | 4): KoglType {
  const mapping: Record<number, KoglType> = {
    1: "KOGL-1",
    2: "KOGL-2",
    3: "KOGL-3",
    4: "KOGL-4",
  }
  return mapping[hmcType] || "KOGL-1"
}

export function mapHMCToContractClauses(
  contractId: string,
  evidenceClauses: HMCEvidenceClause[]
): Partial<ContractClause>[] {
  return evidenceClauses.map((clause, index) => ({
    id: `clause-${contractId}-${index}`,
    contract_id: contractId,
    clause_type: mapClauseType(clause.clause_type),
    clause_text: clause.text,
    match_score: clause.confidence,
    page_number: clause.page_number || null,
    char_start: null,
    char_end: null,
    template_id: null,
  }))
}

function mapClauseType(hmcType: string): ClauseType {
  const mapping: Record<string, ClauseType> = {
    OWNERSHIP: "OWNERSHIP",
    LICENSE: "LICENSE",
    DERIVATIVE: "DERIVATIVE",
    SCOPE: "SCOPE",
    TERM: "TERM",
    ATTRIBUTION: "ATTRIBUTION",
  }
  return mapping[hmcType.toUpperCase()] || "SCOPE"
}

// ========================================
// Mock 데이터 (API 미연결 시 사용)
// ========================================
function getMockClassifyResponse(): HMCClassifyResponse {
  const types: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
  const randomType = types[Math.floor(Math.random() * types.length)]

  return {
    success: true,
    request_id: `mock_hmc_${Date.now()}`,
    kogl_type: randomType,
    confidence: 0.85 + Math.random() * 0.15,
    evidence_clauses: [
      {
        clause_type: "OWNERSHIP",
        text: "(Mock) 본 계약에 의한 저작물의 저작재산권은 발주기관에 귀속한다.",
        page_number: 2,
        confidence: 0.92,
      },
      {
        clause_type: "LICENSE",
        text: "(Mock) 수급인은 발주기관의 사전 서면 동의 없이 본 저작물을 상업적 목적으로 이용할 수 없다.",
        page_number: 3,
        confidence: 0.88,
      },
    ],
    policy_constraints: {
      commercial_use: randomType <= 2,
      derivative_work: randomType <= 2,
      territory: "대한민국",
      term: "저작재산권 보호기간 만료 시까지",
    },
  }
}
