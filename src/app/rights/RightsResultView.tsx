"use client"

import type {
  RightsPredictResponse, RightsResultItem, RightsEvidenceItem, RightsStatus,
} from "@/lib/api/rights-types"

const GROUP_ORDER = ["저작재산권", "이용조건", "계약성격", "이용범위", "대가조건", "기타"]

function statusChip(item: RightsResultItem) {
  if (item.review_required) return { label: "확인필요", cls: "bg-amber-100 text-amber-800" }
  const map: Partial<Record<RightsStatus, { label: string; cls: string }>> = {
    ALLOW: { label: item.display_result, cls: "bg-green-100 text-green-700" },
    PROHIBIT: { label: item.display_result, cls: "bg-red-100 text-red-700" },
    UNKNOWN: { label: "-", cls: "bg-gray-100 text-gray-400" },
  }
  return map[item.status] || { label: item.display_result || "-", cls: "bg-slate-100 text-slate-700" }
}

export default function RightsResultView({ data }: { data: RightsPredictResponse }) {
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    rows: data.rights_results.filter((r) => r.group === g),
  })).filter((x) => x.rows.length > 0)

  return (
    <div className="space-y-6">
      {/* 요약 */}
      <div className="flex gap-3 flex-wrap">
        <SummaryPill label="허용/확정" value={data.summary.safe} color="#059669" />
        <SummaryPill label="확인필요" value={data.summary.review} color="#D97706" />
        <SummaryPill label="없음" value={data.summary.none} color="#6B7280" />
        <SummaryPill label="근거" value={data.summary.evidence_count} color="#2563EB" />
      </div>

      {/* 권리 그룹 테이블 */}
      {grouped.map(({ group, rows }) => (
        <div key={group} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <span className="text-sm font-bold text-gray-700">{group}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500">
                <th className="text-left px-4 py-2 w-[180px]">권리</th>
                <th className="text-left px-4 py-2 w-[110px]">판정</th>
                <th className="text-left px-4 py-2 w-[90px]">신뢰도</th>
                <th className="text-left px-4 py-2">근거번호</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chip = statusChip(r)
                return (
                  <tr key={r.authority} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-900">{r.authority_ko}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${chip.cls}`}>
                        {chip.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-gray-600">
                      {r.confidence == null ? "-" : `${(r.confidence * 100).toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {r.evidence_numbers.length ? r.evidence_numbers.join(", ") : "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* 근거 목록 */}
      {data.evidence.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">근거 목록</h3>
          <ol className="space-y-2">
            {data.evidence.map((ev: RightsEvidenceItem) => (
              <li key={ev.evidence_no} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                  {ev.evidence_no}
                </span>
                <div>
                  <span className="text-gray-500 text-xs mr-2">{ev.authority_ko}</span>
                  <span className="text-gray-900">{ev.text}</span>
                  <span className="text-gray-400 text-xs ml-2">({(ev.confidence * 100).toFixed(0)}%)</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ backgroundColor: color + "18", color }}>
      {label} <span className="tabular-nums font-bold">{value}</span>
    </span>
  )
}
