"use client"

import type {
  RightsPredictResponse, RightsResultItem, RightsEvidenceItem, RightsStatus,
} from "@/lib/api/rights-types"

const GROUP_ORDER = ["저작재산권", "이용조건", "계약성격", "이용범위", "대가조건", "기타"]

const STATUS_KO: Partial<Record<RightsStatus, string>> = { ALLOW: "허용", PROHIBIT: "금지" }

const KOGL_TYPE_META: Record<string, { label: string; desc: string; color: string }> = {
  "유형1": { label: "제1유형", desc: "출처표시", color: "#00845A" },
  "유형2": { label: "제2유형", desc: "출처표시 + 상업적 이용금지", color: "#2563EB" },
  "유형3": { label: "제3유형", desc: "출처표시 + 변경금지", color: "#D97706" },
  "유형4": { label: "제4유형", desc: "출처표시 + 상업적 이용금지 + 변경금지", color: "#DC2626" },
}

function statusChip(item: RightsResultItem) {
  if (item.review_required) return { label: "확인필요", cls: "bg-amber-100 text-amber-800" }
  const map: Partial<Record<RightsStatus, { label: string; cls: string }>> = {
    ALLOW: { label: item.display_result, cls: "bg-green-100 text-green-700" },
    PROHIBIT: { label: item.display_result, cls: "bg-red-100 text-red-700" },
    UNKNOWN: { label: "-", cls: "bg-gray-100 text-gray-400" },
  }
  return map[item.status] || { label: item.display_result || "-", cls: "bg-slate-100 text-slate-700" }
}

export default function RightsResultView({ data, ocrText }: { data: RightsPredictResponse; ocrText?: string | null }) {
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    rows: data.rights_results.filter((r) => r.group === g),
  })).filter((x) => x.rows.length > 0)

  const type = data.type
  const typeMeta = type ? KOGL_TYPE_META[type.predicted_type] : null

  return (
    <div className="space-y-6">
      {/* 유형 추정 */}
      {type && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">공공누리 유형 추정</h3>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold text-white"
              style={{ backgroundColor: (typeMeta?.color) || "#00845A" }}>
              {typeMeta?.label || type.predicted_type}
            </span>
            {typeMeta && <span className="text-sm text-gray-600">{typeMeta.desc}</span>}
            <span className="text-sm text-gray-500 tabular-nums">
              신뢰도 {(type.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {type.axes.map((a) => (
              <span key={a.axis}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                  a.status === "ALLOW" ? "bg-green-100 text-green-700" : a.status === "PROHIBIT" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"
                }`}>
                {a.axis_ko}: {a.status_ko} <span className="opacity-60 tabular-nums">{(a.confidence * 100).toFixed(0)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 요약 */}
      <div className="flex gap-3 flex-wrap">
        <SummaryPill label="허용/확정" value={data.summary.safe} color="#059669" />
        <SummaryPill label="확인필요" value={data.summary.review} color="#D97706" />
        <SummaryPill label="없음" value={data.summary.none} color="#6B7280" />
        <SummaryPill label="근거" value={data.summary.evidence_count} color="#2563EB" />
      </div>

      {/* 원본 문서 + 근거 하이라이트 */}
      {ocrText && ocrText.trim() && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-sm font-bold text-gray-700">원본 문서 (근거 하이라이트)</h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <Legend color="#dbeafe" border="#2563eb" label="유형 근거" />
              <Legend color="#dcfce7" border="#059669" label="허용" />
              <Legend color="#fee2e2" border="#dc2626" label="금지" />
            </div>
          </div>
          <DocumentHighlight text={ocrText} data={data} />
        </div>
      )}

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

      {/* 권리 근거 목록 */}
      {data.evidence.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">권리 근거 목록</h3>
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

/** 원본 문서에 유형·권리 근거를 색상 하이라이트 */
function DocumentHighlight({ text, data }: { text: string; data: RightsPredictResponse }) {
  interface Span { start: number; end: number; bg: string; border: string; label: string }
  const spans: Span[] = []

  // 유형 근거 (파랑)
  for (const ev of data.type?.evidence ?? []) {
    if (typeof ev.start_char !== "number" || typeof ev.end_char !== "number") continue
    spans.push({
      start: ev.start_char, end: ev.end_char, bg: "#dbeafe", border: "#2563eb",
      label: `${ev.axis_ko}: ${STATUS_KO[ev.status] ?? ev.status}`,
    })
  }
  // 권리 근거 (상태별 색)
  for (const ev of data.evidence ?? []) {
    if (typeof ev.start_char !== "number" || typeof ev.end_char !== "number") continue
    const isAllow = ev.status === "ALLOW"
    const isProhibit = ev.status === "PROHIBIT"
    spans.push({
      start: ev.start_char, end: ev.end_char,
      bg: isProhibit ? "#fee2e2" : isAllow ? "#dcfce7" : "#ecfdf5",
      border: isProhibit ? "#dc2626" : isAllow ? "#059669" : "#059669",
      label: `${ev.authority_ko}: ${STATUS_KO[ev.status] ?? ev.status}`,
    })
  }

  // 정렬 + 겹침 제거 (앞선 것 우선)
  const valid = spans
    .filter((s) => s.start >= 0 && s.end > s.start && s.end <= text.length)
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))

  const parts: React.ReactNode[] = []
  let cursor = 0
  let key = 0
  for (const s of valid) {
    if (s.start < cursor) continue // 겹치면 건너뜀
    if (cursor < s.start) parts.push(<span key={key++}>{text.slice(cursor, s.start)}</span>)
    parts.push(
      <mark key={key++} title={s.label}
        style={{ background: s.bg, borderBottom: `2px solid ${s.border}`, borderRadius: 3, padding: "1px 1px" }}>
        {text.slice(s.start, s.end)}
        <sup className="ml-0.5 text-[10px] font-bold" style={{ color: s.border }}>{s.label}</sup>
      </mark>
    )
    cursor = s.end
  }
  if (cursor < text.length) parts.push(<span key={key++}>{text.slice(cursor)}</span>)

  return (
    <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-y-auto border border-gray-100 rounded-md p-3 bg-gray-50/50">
      {parts}
    </div>
  )
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: color, border: `1px solid ${border}` }} />
      {label}
    </span>
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
