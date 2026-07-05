// 권리추정 어댑터 — rights-server /api/v1/rights/predict
import { API_CONFIG } from "./config"
import type { RightsPredictRequest, RightsPredictResponse } from "./rights-types"

export async function predictRights(
  text: string,
  fileName?: string,
): Promise<RightsPredictResponse> {
  if (API_CONFIG.useMockRights) {
    return getMockRightsResponse(text, fileName)
  }
  const request: RightsPredictRequest = {
    file_name: fileName || "",
    text,
    options: {
      max_length: 512,
      max_evidence: 20,
      evidence_threshold: 0.7,
      return_offsets: true,
      return_evidence_text: true,
      include_debug: false,
    },
  }
  const res = await fetch(`${API_CONFIG.RIGHTS_API_BASE_URL}/api/v1/rights/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error(err?.detail || `권리추정 API 오류: ${res.status}`)
  }
  return res.json()
}

export async function checkRightsHealth(): Promise<{ ok: boolean; right_loaded: boolean }> {
  if (API_CONFIG.useMockRights) {
    return { ok: true, right_loaded: true }
  }
  const res = await fetch(`${API_CONFIG.RIGHTS_API_BASE_URL}/api/v1/health`)
  if (!res.ok) throw new Error(`권리 Health 확인 실패: ${res.status}`)
  return res.json()
}

export function getMockRightsResponse(
  text: string,
  fileName?: string,
): RightsPredictResponse {
  const has = (kw: string) => text.includes(kw)
  return {
    ok: true,
    document_id: null,
    file_name: fileName || "mock_contract.txt",
    model: {
      model_kind: "authority_finalschema_multilabel_grounded_v4",
      base_model: "klue/roberta-base",
      checkpoint: "권리추정_260610.pt",
      evidence_threshold: 0.7,
      top_k: 5,
    },
    summary: { safe: 3, review: 1, none: 1, evidence_count: 3 },
    rights_results: [
      { group: "저작재산권", authority: "RIGHT_REPRODUCTION", authority_ko: "복제권",
        status: "ALLOW", display_result: "허용", confidence: 0.98,
        evidence_numbers: [1], review_required: false },
      { group: "저작재산권", authority: "RIGHT_EXHIBITION", authority_ko: "전시권",
        status: has("전시") ? "PROHIBIT" : "UNKNOWN",
        display_result: has("전시") ? "금지" : "-",
        confidence: has("전시") ? 0.95 : null,
        evidence_numbers: has("전시") ? [2] : [], review_required: false },
      { group: "이용조건", authority: "COMMERCIAL_USE", authority_ko: "상업적 이용",
        status: "ALLOW", display_result: "허용", confidence: 0.9,
        evidence_numbers: [3], review_required: false },
      { group: "계약성격", authority: "EXCLUSIVITY", authority_ko: "독점성",
        status: "UNKNOWN", display_result: "-", confidence: null,
        evidence_numbers: [], review_required: false },
      { group: "이용범위", authority: "TERRITORY_SCOPE", authority_ko: "이용지역",
        status: "UNKNOWN", display_result: "-", confidence: null,
        evidence_numbers: [], review_required: true },
    ],
    evidence: [
      { evidence_no: 1, authority: "RIGHT_REPRODUCTION", authority_ko: "복제권",
        status: "ALLOW", text: "(Mock) ☑ 복제권", start_char: 0, end_char: 10, confidence: 0.93 },
      { evidence_no: 2, authority: "RIGHT_EXHIBITION", authority_ko: "전시권",
        status: "PROHIBIT", text: "(Mock) □ 전시권", start_char: 12, end_char: 22, confidence: 0.91 },
      { evidence_no: 3, authority: "COMMERCIAL_USE", authority_ko: "상업적 이용",
        status: "ALLOW", text: "(Mock) 유상 사업에 이용할 수 있다.", start_char: 24, end_char: 44, confidence: 0.9 },
    ],
  }
}
