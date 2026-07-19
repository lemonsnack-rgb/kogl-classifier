import { Plus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

const CARD_BASE =
  "bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition p-5 text-left cursor-pointer min-h-[200px] flex flex-col"

/** 목록 첫 칸의 "새 검사 시작" 카드 (3메뉴 공통). */
export function NewRecordCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 hover:border-accent-400 hover:bg-accent-50/30 transition-colors cursor-pointer min-h-[200px]"
    >
      <span className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
        <Plus className="w-7 h-7 text-gray-400" />
      </span>
      <span className="text-base font-semibold text-gray-600">{label}</span>
    </button>
  )
}

/**
 * 목록 레코드 카드 (3메뉴 공통).
 * 아이콘 + 제목 / 판정 배지(badges) / 상태(status) / 하단 좌·우 메타(footerLeft·footerRight).
 */
export function RecordCard({
  icon: Icon,
  title,
  badges,
  status,
  footerLeft,
  footerRight,
  onClick,
}: {
  icon: LucideIcon
  title: string
  badges?: ReactNode
  status?: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className={CARD_BASE}>
      <div className="flex items-start gap-3 mb-3">
        <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon className="w-[18px] h-[18px] text-gray-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-gray-900 truncate leading-snug">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-2 min-h-[22px]">{badges}</div>

      {status && <div className="mb-3">{status}</div>}

      <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
        <span className="truncate">{footerLeft}</span>
        <span className="flex-shrink-0 tabular-nums">{footerRight}</span>
      </div>
    </button>
  )
}

/** 판정 상태 배지 (점 + 라벨). semantic 색은 호출부에서 지정. */
export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: color + "18", color }}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
