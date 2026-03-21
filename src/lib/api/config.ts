// ========================================
// API 설정 - 서버 주소만 여기서 교체하면 됨
// ========================================

export const API_CONFIG = {
  // 숭실대 OCR + 메타데이터 추출 API
  SSU_API_BASE_URL: process.env.NEXT_PUBLIC_SSU_API_URL || "",

  // HMC 공공누리 유형 분류 API
  HMC_API_BASE_URL: process.env.NEXT_PUBLIC_HMC_API_URL || "",

  // Mock 모드 여부 (API URL이 없으면 자동으로 Mock)
  get useMock(): boolean {
    return !this.SSU_API_BASE_URL && !this.HMC_API_BASE_URL
  },

  get useMockSSU(): boolean {
    return !this.SSU_API_BASE_URL
  },

  get useMockHMC(): boolean {
    return !this.HMC_API_BASE_URL
  },
}

// 문서 유형 (숭실대 API document_type 파라미터)
export const DOCUMENT_TYPES = [
  { value: "계약서", label: "계약서" },
  { value: "동의서", label: "동의서" },
  { value: "저작재산권 양도동의서", label: "저작재산권 양도동의서" },
  { value: "공공저작물 자유이용허락 동의서", label: "공공저작물 자유이용허락 동의서" },
  { value: "기타문서", label: "기타문서" },
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"]
