"use client"

import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { mockContracts, getStatusCounts } from "@/lib/mock/data"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { KoglType, ContractStatus } from "@/types"

export default function DashboardPage() {
  const router = useRouter()
  const counts = getStatusCounts()

  // 최근 5건 (등록일 내림차순)
  const recentContracts = [...mockContracts]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5)

  const statCards = [
    {
      label: "전체",
      value: counts.total,
      color: "bg-primary-700",
      textColor: "text-white",
    },
    {
      label: "처리중",
      value: counts.processing,
      color: "bg-blue-50",
      textColor: "text-blue-700",
      dotColor: "bg-status-processing",
    },
    {
      label: "완료",
      value: counts.completed,
      color: "bg-green-50",
      textColor: "text-green-700",
      dotColor: "bg-status-complete",
    },
    {
      label: "검토필요",
      value: counts.review_required,
      color: "bg-yellow-50",
      textColor: "text-yellow-700",
      dotColor: "bg-status-review",
    },
  ]

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`
  }

  function getStatusClass(status: ContractStatus) {
    switch (status) {
      case "uploaded":
        return "status-badge status-uploaded"
      case "ocr_processing":
      case "classifying":
        return "status-badge status-processing"
      case "review_required":
        return "status-badge status-review"
      case "completed":
        return "status-badge status-complete"
      case "failed":
        return "status-badge status-failed"
      default:
        return "status-badge"
    }
  }

  function getKoglBadgeClass(type: KoglType) {
    const num = type.replace("KOGL-", "")
    return `kogl-badge kogl-badge-${num}`
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 페이지 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
            <p className="text-sm text-gray-500 mt-1">
              공공저작물 권리유형 분류 현황을 한눈에 확인하세요.
            </p>
          </div>
          <button
            onClick={() => router.push("/upload")}
            className="px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            새 문서 업로드
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl p-5 ${card.color} ${card.textColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {card.dotColor && (
                  <span
                    className={`w-2 h-2 rounded-full ${card.dotColor}`}
                  />
                )}
                <span className="text-sm font-medium opacity-80">
                  {card.label}
                </span>
              </div>
              <div className="text-3xl font-bold">{card.value}</div>
            </div>
          ))}
        </div>

        {/* 최근 처리결과 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              최근 처리결과
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    계약서명
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                    저작물 수
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentContracts.map((contract) => (
                  <tr
                    key={contract.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/results/${contract.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {contract.is_institution_made
                          ? "기관 자체 제작물"
                          : contract.contract_filename}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {contract.gongnuri_type ? (
                        <span
                          className={getKoglBadgeClass(contract.gongnuri_type)}
                        >
                          {KOGL_TYPES[contract.gongnuri_type].label}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-700">
                        {contract.works_count ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={getStatusClass(contract.status)}>
                        {STATUS_META[contract.status].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {formatDate(contract.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
