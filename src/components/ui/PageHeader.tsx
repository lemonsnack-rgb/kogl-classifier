import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * 3메뉴(검사하기·권리추정·통합) 공통 페이지 헤더.
 * 아이콘 + 타이틀(Display 20/700) + 한 줄 설명 + 우측 액션 슬롯. 뒤로가기(선택).
 * 디자인 가이드라인 §4 PageHeader 정의를 따른다.
 */
export default function PageHeader({
  icon: Icon,
  title,
  description,
  backHref,
  backLabel,
  right,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  backHref?: string
  backLabel?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-6">
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary-600" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-tight">{title}</h1>
            {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
          </div>
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </div>
  )
}
