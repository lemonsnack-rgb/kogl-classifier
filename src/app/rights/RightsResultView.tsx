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

interface HmcType {
  predicted_type: string
  predicted_display?: string
  description?: string
  confidence?: number
  evidence_sentences?: { sentence: string; best_type?: string; score?: number }[]
}

export default function RightsResultView({
  data, ocrText, showType = true, showHighlight = true, metadata, hmcType,
}: {
  data: RightsPredictResponse
  ocrText?: string | null
  showType?: boolean
  showHighlight?: boolean
  metadata?: Record<string, unknown> | null
  hmcType?: HmcType | null
}) {
  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    rows: data.rights_results.filter((r) => r.group === g),
  })).filter((x) => x.rows.length > 0)

  const type = data.type
  const typeMeta = type ? KOGL_TYPE_META[type.predicted_type] : null
  const hmcMeta = hmcType ? KOGL_TYPE_META[hmcType.predicted_type] : null

  return (
    <div className="space-y-6">
      {/* 저작물/문서 메타데이터 */}
      {metadata && (isCombinedMeta(metadata) ? (
        <CombinedMetadata data={metadata} />
      ) : hasAnyValue(metadata) ? (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">저작물 메타데이터</h3>
          <MetadataTable data={metadata} />
        </div>
      ) : null)}

      {/* 공공누리 유형 (HMC 유형분류 API) */}
      {hmcType && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">공공누리 유형 (유형분류 모델)</h3>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold text-white"
              style={{ backgroundColor: hmcMeta?.color || "#00845A" }}>
              {hmcMeta?.label || hmcType.predicted_display || hmcType.predicted_type}
            </span>
            {(hmcType.description || hmcMeta?.desc) && <span className="text-sm text-gray-600">{hmcType.description || hmcMeta?.desc}</span>}
            {typeof hmcType.confidence === "number" && (
              <span className="text-sm text-gray-500 tabular-nums">신뢰도 {(hmcType.confidence * 100).toFixed(1)}%</span>
            )}
          </div>
          {hmcType.evidence_sentences && hmcType.evidence_sentences.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">유형 근거 문장</p>
              <ol className="space-y-1.5">
                {hmcType.evidence_sentences.map((ev, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-gray-800">{ev.sentence}
                      {typeof ev.score === "number" && <span className="text-gray-400 text-xs ml-2">({(ev.score * 100).toFixed(0)}%)</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* 유형 추정 (축 기반 모델 — 사용 시) */}
      {showType && type && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">공공누리 유형 추정</h3>
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
      {showHighlight && ocrText && ocrText.trim() && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-[15px] font-bold text-gray-800 tracking-tight">원본 문서 (근거 하이라이트)</h3>
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
            <span className="text-[15px] font-bold text-gray-800 tracking-tight">{group}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[440px]">
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
        </div>
      ))}

      {/* 권리 근거 목록 */}
      {data.evidence.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">권리 근거 목록</h3>
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

/* ── 저작물 메타데이터 (SSU 추출) 렌더러 ── */
const META_LABELS: Record<string, string> = {
  work_title: "계약 제목", work_names: "계약 제목", title: "제목", keyword: "주제어", keywords: "주제어",
  work_category: "저작물 분류", work_type: "유형", rights_holder: "권리자",
  copyright_holder: "저작권자", author: "저작자", creator: "제작자",
  agency_name: "기관명", institution: "기관", language: "언어", description: "설명",
  contract_type: "계약서 유형", consent_type: "동의서 유형",
  granted_rights: "양도 권리", economic_rights: "저작재산권", commercial_use: "상업적 이용",
  contract_purpose: "계약 목적", contract_duration: "계약 기간",
  effective_date: "시작일", expiration_date: "종료일", created_date: "제작일", production_date: "제작일",
  signature_date: "서명일", consent_date: "동의 날짜", consent_status: "동의 여부",
  payment_amount: "대금", special_terms: "특약사항",
  user: "이용기관", parties: "당사자", name: "이름", role: "역할", phone: "연락처", address: "주소", email: "이메일",
  data_subject: "정보주체", data_controller: "처리기관", registration_no: "등록번호",
}
// 관리자에게 무의미한 내부 처리 필드 — 화면에서 숨긴다.
const HIDDEN_META_KEYS = new Set([
  "checkbox_info", "checkbox_pattern_detected", "pattern_detected", "checkbox_fields_found",
  "extraction_confidence", "processing_info", "error", "ner_error", "consolidation_error",
  "ner_model_key", "consolidation_model", "available_types",
])
function metaLabel(k: string): string { return META_LABELS[k] ?? k }
function metaVisible(k: string): boolean { return !HIDDEN_META_KEYS.has(k) }

function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === "string") { const t = v.trim(); return t !== "" && t !== "-" }
  if (typeof v === "number" || typeof v === "boolean") return true
  if (Array.isArray(v)) return v.some(isMeaningful)
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(isMeaningful)
  return false
}
function hasAnyValue(data: Record<string, unknown>): boolean {
  return Object.values(data).some(isMeaningful)
}

function MetaValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="text-gray-400">-</span>
  if (typeof value === "boolean")
    return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{value ? "해당" : "해당없음"}</span>
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400">-</span>
    if (typeof value[0] === "object") {
      return (
        <div className="space-y-1.5">
          {value.map((item, i) => (
            <div key={i} className="border border-gray-100 rounded p-2 bg-gray-50/50">
              <MetaValue value={item} />
            </div>
          ))}
        </div>
      )
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v, i) => <span key={i} className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">{String(v)}</span>)}
      </div>
    )
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(([k, v]) => metaVisible(k) && isMeaningful(v))
    if (entries.length === 0) return <span className="text-gray-400">-</span>
    return (
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs">
            <span className="text-gray-500 flex-shrink-0">{metaLabel(k)}</span>
            <span className="text-gray-900 min-w-0"><MetaValue value={v} /></span>
          </div>
        ))}
      </div>
    )
  }
  return <span className="text-gray-900">{String(value)}</span>
}

function MetadataTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k, v]) => metaVisible(k) && isMeaningful(v))
  if (entries.length === 0) return <p className="text-sm text-gray-400">추출된 메타데이터가 없습니다.</p>
  return (
    <div className="border border-gray-100 rounded-lg overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-gray-50 last:border-0 align-top">
              <td className="px-3 py-2 text-gray-500 font-medium w-[160px] align-top">{metaLabel(k)}</td>
              <td className="px-3 py-2 text-gray-900"><MetaValue value={v} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── 통합: { contract, works } 구조 메타데이터 ── */
function isCombinedMeta(m: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(m, "contract") || Object.prototype.hasOwnProperty.call(m, "works")
}

const WORK_FIELD_LABELS: [string, string][] = [
  ["work_name", "저작물명"], ["work_type", "유형"], ["digital_format", "디지털화형태"],
  ["description", "설명"], ["keywords", "주제어"], ["language", "언어"],
  ["created_date", "제작일"], ["creator", "제작자"], ["copyright_holder", "저작권자"],
  ["co_authors", "공동저작자"], ["neighboring_rights_holder", "저작인접권자"],
  ["disclosure_type", "공개유형"], ["copyrightability", "저작물성"], ["non_protected_work", "비보호저작물"],
  ["work_for_hire", "업무상저작물"], ["commercial_use", "상업적이용허락"], ["property_rights", "저작재산권"],
  ["co_author_consent", "공동저작자동의"], ["validity_period", "유효기간"], ["portrait_rights", "초상권"],
]

function CombinedMetadata({ data }: { data: Record<string, unknown> }) {
  const contract = (data.contract as Record<string, unknown> | null) || null
  const works = (data.works as Record<string, unknown>[] | undefined) || []
  return (
    <div className="space-y-4">
      {/* ① 계약서 추출 정보 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">계약서 추출 정보</h3>
        {contract && hasAnyValue(contract)
          ? <MetadataTable data={contract} />
          : <p className="text-sm text-gray-400">추출된 계약서 메타데이터가 없습니다.</p>}
      </div>

      {/* ② 저작물 메타데이터 (파일별 20항목) */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">저작물 메타데이터 ({works.length}건)</h3>
        {works.length === 0 ? (
          <p className="text-sm text-gray-400">업로드된 저작물이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {works.map((w, i) => (
              <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-700">{String(w.work_filename || `저작물 ${i + 1}`)}</span>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {WORK_FIELD_LABELS.map(([k, label]) => (
                      <tr key={k} className="border-b border-gray-50 last:border-0">
                        <td className="px-3 py-1.5 text-gray-500 w-[140px] align-top">{label}</td>
                        <td className="px-3 py-1.5 text-gray-900">
                          {isMeaningful(w[k]) ? <MetaValue value={w[k]} /> : <span className="text-gray-400 italic">미식별</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
