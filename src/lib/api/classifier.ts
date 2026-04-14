// ========================================
// HMC 공공누리 유형 분류 어댑터
// ========================================
// HMC FastAPI 서버: POST /api/predict
// 입력: OCR 텍스트 (JSON)
// 출력: 유형 1~4 + 신뢰도 + 근거 문장
//
// 연동: .env.local에 NEXT_PUBLIC_HMC_API_URL=http://xxx:3410 설정

import { API_CONFIG } from "./config"
import type {
  HMCPredictRequest,
  HMCPredictResponse,
  HMCEvidenceSentence,
} from "./types"
import type { KoglType, ContractClause } from "@/types"

// ========================================
// 1. 분류 요청 (메인 API)
// ========================================
export async function classifyKoglType(
  ocrText: string,
  fileName?: string
): Promise<HMCPredictResponse> {
  if (API_CONFIG.useMockHMC) {
    return getMockPredictResponse(ocrText, fileName)
  }

  const request: HMCPredictRequest = {
    text: ocrText,
    file_name: fileName || "",
    auto_detect_form: true,
    prediction_threshold: 0.55,
    evidence_threshold: 0.30,
    max_evidence_sentences: 10,
  }

  const response = await fetch(
    `${API_CONFIG.HMC_API_BASE_URL}/api/predict`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || `HMC API 오류: ${response.status}`)
  }

  return response.json()
}

// ========================================
// 2. HMC "유형1"~"유형4" → KOGL-1~4 변환
// ========================================
export function mapHMCToKoglType(hmcType: string): KoglType {
  const mapping: Record<string, KoglType> = {
    "유형1": "KOGL-1",
    "유형2": "KOGL-2",
    "유형3": "KOGL-3",
    "유형4": "KOGL-4",
  }
  return mapping[hmcType] || "KOGL-1"
}

// ========================================
// 3. 근거 문장 → ContractClause 변환
// ========================================
export function mapHMCToContractClauses(
  contractId: string,
  evidenceSentences: HMCEvidenceSentence[]
): Partial<ContractClause>[] {
  return evidenceSentences.map((ev, index) => ({
    id: `hmc-clause-${contractId}-${index}`,
    contract_id: contractId,
    clause_type: "SCOPE" as const,
    clause_text: ev.sentence,
    match_score: ev.score,
    page_number: null,
    char_start: null,
    char_end: null,
    template_id: null,
  }))
}

// ========================================
// 4. 서버 상태 확인
// ========================================
export async function checkHMCHealth(): Promise<{
  ok: boolean
  device: string
  engines: { id: string; name: string; valid: boolean }[]
}> {
  if (API_CONFIG.useMockHMC) {
    return {
      ok: true,
      device: "mock",
      engines: [{ id: "mock", name: "Mock Engine", valid: true }],
    }
  }

  const response = await fetch(`${API_CONFIG.HMC_API_BASE_URL}/api/health`)
  if (!response.ok) {
    throw new Error(`HMC Health 확인 실패: ${response.status}`)
  }
  return response.json()
}

// ========================================
// 5. 엔진 목록 조회
// ========================================
export async function getHMCEngines(): Promise<{
  ok: boolean
  selected_engine_id: string
  engines: { id: string; name: string; valid: boolean; form_type: string }[]
}> {
  if (API_CONFIG.useMockHMC) {
    return {
      ok: true,
      selected_engine_id: "kogl_integrated",
      engines: [
        { id: "kogl_integrated", name: "KOGL 통합 엔진", valid: true, form_type: "통합" },
      ],
    }
  }

  const response = await fetch(`${API_CONFIG.HMC_API_BASE_URL}/api/engines`)
  if (!response.ok) {
    throw new Error(`HMC 엔진 목록 조회 실패: ${response.status}`)
  }
  return response.json()
}

// ========================================
// Mock 데이터
// ========================================
function getMockPredictResponse(
  ocrText: string,
  fileName?: string
): HMCPredictResponse {
  // 텍스트 내용으로 유형 추정 (데모용)
  const hasCommercialRestriction =
    ocrText.includes("비영리") || ocrText.includes("비상업") || ocrText.includes("상업적 이용금지")
  const hasDerivativeRestriction =
    ocrText.includes("변경금지") || ocrText.includes("변경 불가") || ocrText.includes("동일성")

  let predictedType = "유형1"
  if (hasCommercialRestriction && hasDerivativeRestriction) predictedType = "유형4"
  else if (hasCommercialRestriction) predictedType = "유형2"
  else if (hasDerivativeRestriction) predictedType = "유형3"

  const descriptions: Record<string, string> = {
    "유형1": "출처표시 + 상업허용 + 변경허용",
    "유형2": "출처표시 + 비영리 + 변경허용",
    "유형3": "출처표시 + 상업허용 + 변경금지",
    "유형4": "출처표시 + 비영리 + 변경금지",
  }

  return {
    ok: true,
    file_name: fileName || "mock_file.txt",
    device: "mock",
    selected_engine_id: "kogl_integrated",
    selected_engine_name: "KOGL 통합 엔진 (Mock)",
    resolved_engine_id: "kogl_integrated",
    resolved_engine_name: "KOGL 통합 엔진 (Mock)",
    resolved_model_dir: "./best_model",
    detected_form_type: "통합",
    preprocessed_text: ocrText.slice(0, 200),
    predicted_type: predictedType,
    predicted_display: predictedType,
    predicted_description: descriptions[predictedType],
    confidence: 0.82 + Math.random() * 0.15,
    probabilities: {
      "유형1": predictedType === "유형1" ? 0.85 : 0.05,
      "유형2": predictedType === "유형2" ? 0.85 : 0.05,
      "유형3": predictedType === "유형3" ? 0.85 : 0.03,
      "유형4": predictedType === "유형4" ? 0.85 : 0.02,
    },
    evidence_sentences: [
      {
        sentence: "(Mock) 본 계약에 의한 저작물의 저작재산권은 발주기관에 귀속한다.",
        best_type: predictedType,
        score: 0.92,
      },
      {
        sentence: "(Mock) 이용자는 출처를 표시하여야 한다.",
        best_type: predictedType,
        score: 0.78,
      },
    ],
    settings_used: {
      prediction_threshold: 0.55,
      evidence_threshold: 0.30,
      auto_detect_form: true,
    },
    settings_path: "mock",
  }
}
