"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { getContracts } from "@/lib/mock/data"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { KoglType, ContractStatus } from "@/types"
import { Plus, FileText, Search } from "lucide-react"

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function WorksPage() {
  const router = useRouter()
  const allContracts = getContracts()
  const [searchQuery, setSearchQuery] = useState("")

  const contracts = useMemo(() => {
    if (!searchQuery.trim()) return allContracts
    const q = searchQuery.toLowerCase()
    return allContracts.filter(
      (c) =>
        (c.inspection_title && c.inspection_title.toLowerCase().includes(q)) ||
        (c.contract_filename && c.contract_filename.toLowerCase().includes(q))
    )
  }, [allContracts, searchQuery])

  return (
    <AppLayout>
      <div>
        {/* 상단 영역: 타이틀 + 검색 */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex-shrink-0">검사하기</h2>
          <div className="flex items-center gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="검사명, 파일명으로 검색"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              />
            </div>
          </div>
        </div>

        {/* 카드 그리드 - 4열, 꽉 차게 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* 새 문서 업로드 카드 */}
          <button
            onClick={() => router.push("/works/new")}
            className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-accent-400 hover:bg-accent-50/30 transition-colors cursor-pointer min-h-[200px]"
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus className="w-7 h-7 text-gray-400" />
            </div>
            <span className="text-sm font-medium text-gray-600">
              새 검사 시작
            </span>
          </button>

          {/* 계약서별 카드 */}
          {contracts.map((contract) => (
            <button
              key={contract.id}
              onClick={() => router.push(`/works/${contract.id}`)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition p-6 text-left cursor-pointer min-h-[200px] flex flex-col"
            >
              {/* 상단: 아이콘 + 검사명칭 */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4.5 h-4.5 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {contract.inspection_title
                      ?? (contract.contract_filename
                        ? (contract.contract_filename.length > 20
                          ? contract.contract_filename.slice(0, 20) + "..."
                          : contract.contract_filename)
                        : "(파일 없음)")}
                  </p>
                </div>
              </div>

              {/* 뱃지 줄: KOGL 유형 + 상태 */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {/* KOGL 유형 뱃지 */}
                {contract.gongnuri_type ? (
                  <KoglBadge type={contract.gongnuri_type} />
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                    -
                  </span>
                )}

                {/* 상태 뱃지 */}
                <StatusBadge status={contract.status} />
              </div>

              {/* 하단: 저작물 수 + 등록일 */}
              <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                <span>저작물 {contract.works_count ?? 0}건</span>
                <span>{formatDate(contract.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

/* ====================================================
   Sub Components
==================================================== */

function KoglBadge({ type }: { type: KoglType }) {
  const meta = KOGL_TYPES[type]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: meta.color + "18",
        color: meta.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  )
}
