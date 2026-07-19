import { CheckCircle2, Loader2, XCircle } from "lucide-react"

/**
 * 처리 진행 단계 표시 (3메뉴 공통).
 * 업로드 → OCR·메타데이터 → (유형) → 권리 등, 메뉴별 단계를 받아 현재 단계를 실시간 표시한다.
 * 디자인 가이드라인 §4 ProcessStepper 정의를 따른다. 검사하기 업로드 위저드와 동일 비주얼.
 *
 * - index < current  : 완료(체크)
 * - index === current: 진행중(스피너) / 실패 시 오류(X)
 * - index > current  : 대기
 * current === steps.length 이면 전 단계 완료.
 */
export default function ProcessStepper({
  steps,
  current,
  failed = false,
}: {
  steps: string[]
  current: number
  failed?: boolean
}) {
  return (
    <div className="flex items-center justify-center gap-0 overflow-x-auto py-2">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current && !failed
        const errored = i === current && failed
        return (
          <div key={label} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  errored
                    ? "bg-red-100 text-red-600"
                    : done
                    ? "bg-accent-600 text-white"
                    : active
                    ? "bg-accent-600 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {errored ? (
                  <XCircle className="w-5 h-5" />
                ) : done ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : active ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`mt-2 text-xs font-medium whitespace-nowrap ${
                  errored ? "text-red-600" : done || active ? "text-accent-600" : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-16 sm:w-24 h-0.5 mx-2 mb-6 transition-colors ${
                  i < current ? "bg-accent-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/** rights_checks/combined 상태값 → 진행 단계 인덱스. steps 3칸 기준(업로드·OCR·모델). */
export function stepIndexFromStatus(status: string): { current: number; failed: boolean } {
  switch (status) {
    case "uploaded":
      return { current: 1, failed: false } // 업로드 완료, OCR 진행
    case "ocr_processing":
      return { current: 1, failed: false }
    case "predicting":
    case "classifying":
      return { current: 2, failed: false } // 모델 분석 진행
    case "completed":
      return { current: 3, failed: false } // 전 단계 완료
    case "failed":
      return { current: 2, failed: true }
    default:
      return { current: 0, failed: false }
  }
}
