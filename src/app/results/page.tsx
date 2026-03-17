"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { getContracts, getStatusCounts } from "@/lib/mock/data"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { Contract, ContractStatus, KoglType } from "@/types"

type FilterTab = "all" | "processing" | "completed" | "review_required"

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "processing", label: "처리중" },
  { key: "completed", label: "완료" },
  { key: "review_required", label: "검토필요" },
]

function matchesFilter(contract: Contract, filter: FilterTab): boolean {
  if (filter === "all") return true
  if (filter === "processing")
    return (
      contract.status === "ocr_processing" ||
      contract.status === "classifying" ||
      contract.status === "uploaded"
    )
  if (filter === "completed") return contract.status === "completed"
  if (filter === "review_required")
    return contract.status === "review_required" || contract.status === "failed"
  return true
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function ResultsPage() {
  const router = useRouter()
  const contracts = getContracts()
  const counts = getStatusCounts()

  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const filtered = useMemo(() => {
    return contracts.filter((c) => {
      const tabMatch = matchesFilter(c, activeTab)
      const searchMatch =
        searchQuery.trim() === "" ||
        (c.contract_filename ?? "")
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase())
      return tabMatch && searchMatch
    })
  }, [contracts, activeTab, searchQuery])

  const tabCounts: Record<FilterTab, number> = {
    all: counts.total,
    processing: counts.processing,
    completed: counts.completed,
    review_required: counts.review_required + counts.failed,
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        {/* 페이지 제목 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">처리결과 목록</h1>
          <p className="mt-1 text-sm text-gray-500">
            등록된 계약서의 공공누리 유형 분류 결과를 확인합니다.
          </p>
        </div>

        {/* 필터 탭 */}
        <div className="flex items-center gap-1 mb-4 border-b border-gray-200">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 inline-flex items-center justify-center px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.key
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>

        {/* 검색 */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="계약서명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-200 rounded-md pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  계약서명
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  KOGL 유형
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  저작물 수
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  상태
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  등록일
                </th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center py-12 text-gray-400"
                  >
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => router.push(`/results/${contract.id}`)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-gray-900">
                      {contract.contract_filename ?? "(파일명 없음)"}
                    </td>
                    <td className="px-4 py-3.5">
                      {contract.gongnuri_type ? (
                        <KoglBadge type={contract.gongnuri_type} />
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center text-gray-600">
                      {contract.works_count ?? 0}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-4 py-3.5 text-gray-500">
                      {formatDate(contract.created_at)}
                    </td>
                    <td className="px-4 py-3.5 text-gray-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}

function KoglBadge({ type }: { type: KoglType }) {
  const meta = KOGL_TYPES[type]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
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
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
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
