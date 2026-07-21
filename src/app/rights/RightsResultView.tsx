"use client"

import { useState } from "react"
import { Pencil, Save, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type {
  RightsPredictResponse, RightsResultItem, RightsEvidenceItem, RightsStatus,
} from "@/lib/api/rights-types"
import { KOGL_TYPES, type KoglType } from "@/types"

const KOGL_TYPE_ORDER: KoglType[] = ["KOGL-0", "KOGL-1", "KOGL-2", "KOGL-3", "KOGL-4"]

function isKoglType(v: unknown): v is KoglType {
  return typeof v === "string" && (KOGL_TYPE_ORDER as string[]).includes(v)
}

/* 저작물별 확정 유형 뱃지(제0~4). KOGL_TYPES 색상 사용. */
function TypeBadge({ type }: { type: unknown }) {
  if (!isKoglType(type)) return <span className="text-xs text-gray-400 italic">유형 미판정</span>
  const meta = KOGL_TYPES[type]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label} · {meta.description}
    </span>
  )
}

/* AI유형 뱃지(제1~4에만 병행 표시, 제0은 N/A). 3단계: 가능/불가/판단불가. */
function AiBadge({ status }: { status: boolean | null | undefined }) {
  if (status === true) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border border-indigo-300 text-indigo-700 bg-indigo-50">
        AI 활용 가능
      </span>
    )
  }
  if (status === false) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border border-rose-200 text-rose-600 bg-rose-50">
        AI 활용 불가
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-200 text-gray-400 bg-gray-50">
      AI 판단 불가
    </span>
  )
}

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
  data, ocrText, showType = true, showHighlight = true, metadata, hmcType, recordId, showMetadata = true,
}: {
  data: RightsPredictResponse
  ocrText?: string | null
  showType?: boolean
  showHighlight?: boolean
  metadata?: Record<string, unknown> | null
  hmcType?: HmcType | null
  recordId?: string
  showMetadata?: boolean
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
      {showMetadata && metadata && (isCombinedMeta(metadata) ? (
        <CombinedMetadata data={metadata} recordId={recordId} />
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

export function MetadataTable({ data }: { data: Record<string, unknown> }) {
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

// 저작물 20항목 (검사하기 상세 WorkMetadataTable과 동일한 3범주 그룹핑 + 색상)
const WORK_GROUPS: { title: string; color: string; fields: [string, string][] }[] = [
  {
    title: "저작물정보", color: "border-l-blue-500",
    fields: [
      ["work_name", "저작물명"], ["work_type", "유형"], ["digital_format", "디지털화형태"],
      ["description", "설명"], ["keywords", "주제어"], ["language", "언어"],
      ["created_date", "제작일"], ["creator", "제작자"],
    ],
  },
  {
    title: "저작자정보", color: "border-l-green-500",
    fields: [
      ["copyright_holder", "저작권자"], ["co_authors", "공동저작자"], ["neighboring_rights_holder", "저작인접권자"],
    ],
  },
  {
    title: "권리정보", color: "border-l-amber-500",
    fields: [
      ["disclosure_type", "공개유형"], ["copyrightability", "저작물성"], ["non_protected_work", "비보호저작물"],
      ["work_for_hire", "업무상저작물"], ["commercial_use", "상업적이용허락"], ["property_rights", "저작재산권"],
      ["co_author_consent", "공동저작자동의"], ["validity_period", "유효기간"], ["portrait_rights", "초상권"],
    ],
  },
]
const WORK_FIELD_LABELS: [string, string][] = WORK_GROUPS.flatMap((g) => g.fields)

type AiStatus = "usable" | "not_usable" | "unknown"
function aiToStatus(v: unknown): AiStatus {
  if (v === true) return "usable"
  if (v === false) return "not_usable"
  return "unknown"
}
function statusToAi(s: AiStatus): boolean | null {
  if (s === "usable") return true
  if (s === "not_usable") return false
  return null
}

/* 통합 상세: 검사하기와 동일한 좌우 2분할 + 공유 우측 패널 모델.
   좌측 = 계약서(클릭 시 우측에 계약서 메타) + 저작물 목록(클릭 시 우측에 저작물 메타). */
function CombinedMetadata({ data, recordId }: { data: Record<string, unknown>; recordId?: string }) {
  const contract = (data.contract as Record<string, unknown> | null) || null
  const initialWorks = (data.works as Record<string, unknown>[] | undefined) || []

  const [localWorks, setLocalWorks] = useState(initialWorks)
  // 선택 상태: "contract" = 계약서 메타, 숫자 = 저작물 인덱스, null = 미선택
  const [sel, setSel] = useState<"contract" | number | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [typeForm, setTypeForm] = useState<string>("")
  const [aiForm, setAiForm] = useState<AiStatus>("unknown")
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const isWork = typeof sel === "number"
  const w = isWork ? localWorks[sel] : null

  function toStr(v: unknown): string {
    if (v === null || v === undefined) return ""
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")
    if (typeof v === "object") return JSON.stringify(v)
    return String(v)
  }

  function selectContract() { setSel("contract"); setEditing(false); setSavedMsg(false) }
  function selectWork(i: number) { setSel(i); setEditing(false); setSavedMsg(false) }

  function startEdit() {
    if (!w) return
    const f: Record<string, string> = {}
    for (const [k] of WORK_FIELD_LABELS) f[k] = toStr(w[k])
    setForm(f)
    setTypeForm(isKoglType(w.resolved_type) ? w.resolved_type : "")
    setAiForm(aiToStatus(w.ai_type_applied))
    setEditing(true)
    setSavedMsg(false)
  }
  function cancelEdit() { setEditing(false); setForm({}) }

  async function save() {
    if (!isWork || !w) return
    const updated: Record<string, unknown> = { ...w }
    for (const [k] of WORK_FIELD_LABELS) {
      const val = (form[k] ?? "").trim()
      if (k === "keywords") updated[k] = val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
      else updated[k] = val || null
    }
    // 신유형 판정: 유형(제0~4) + AI유형 3단계(제0이면 N/A=null)
    updated.resolved_type = typeForm || null
    updated.ai_type_applied = typeForm === "KOGL-0" ? null : statusToAi(aiForm)
    const newWorks = localWorks.map((x, i) => (i === sel ? updated : x))
    setSaving(true)
    try {
      if (recordId) {
        const supabase = createClient()
        const { error } = await supabase
          .from("rights_checks")
          .update({ contract_metadata: { contract: contract ?? null, works: newWorks } })
          .eq("id", recordId)
        if (error) throw new Error(error.message)
      }
      setLocalWorks(newWorks)
      setEditing(false)
      setSavedMsg(true)
      setTimeout(() => setSavedMsg(false), 3000)
    } catch (e) {
      alert("저장 실패: " + (e instanceof Error ? e.message : "오류"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">계약서·저작물 메타데이터</h3>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
        {/* 좌: 계약서 + 저작물 목록 */}
        <div className="space-y-1 self-start">
          <button
            onClick={selectContract}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors relative ${
              sel === "contract" ? "bg-primary-50 border border-primary-200" : "hover:bg-gray-50 border border-transparent"
            }`}
          >
            {sel === "contract" && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-600 rounded-r" />}
            <span className="flex-1 min-w-0 text-sm text-gray-900 font-medium truncate">계약서 추출 메타데이터</span>
          </button>
          <div className="px-3 pt-3 pb-1 text-xs font-medium text-gray-400">저작물 ({localWorks.length}건)</div>
          {localWorks.map((item, i) => {
            const name = String(item.work_filename || `저작물 ${i + 1}`)
            const wt = item.work_type ? String(item.work_type) : null
            const active = sel === i
            return (
              <button
                key={i}
                onClick={() => selectWork(i)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors relative ${
                  active ? "bg-primary-50 border border-primary-200" : "hover:bg-gray-50 border border-transparent"
                }`}
                title={name}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-600 rounded-r" />}
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold flex-shrink-0 ${
                  active ? "bg-primary-600 text-white" : "bg-gray-200 text-gray-600"
                }`}>{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm text-gray-900 font-medium truncate">{name}</span>
                {wt && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{WORK_TYPE_LABELS[wt] ?? wt}</span>}
              </button>
            )
          })}
        </div>

        {/* 우: 공유 패널 */}
        <div className="bg-gray-50 rounded-lg p-5 min-w-0">
          {sel === null ? (
            <div className="flex items-center justify-center h-full min-h-[160px]">
              <p className="text-sm text-gray-400">좌측에서 계약서 또는 저작물을 선택하세요</p>
            </div>
          ) : sel === "contract" ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-4">계약서 추출 메타데이터</h4>
              {contract && hasAnyValue(contract)
                ? <MetadataTable data={contract} />
                : <p className="text-sm text-gray-400">추출된 계약서 메타데이터가 없습니다.</p>}
            </div>
          ) : w ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary-600 text-white text-xs font-bold flex-shrink-0">{(sel as number) + 1}</span>
                  <h4 className="text-sm font-semibold text-gray-800 truncate">{String(w.work_filename || `저작물 ${(sel as number) + 1}`)}</h4>
                </div>
                <div className="flex items-center gap-2">
                  {savedMsg && <span className="text-xs text-green-600 font-medium">✓ 저장됨</span>}
                  {!editing ? (
                    <button onClick={startEdit}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors">
                      <Pencil className="w-3 h-3" /> 수정
                    </button>
                  ) : (
                    <>
                      <button onClick={save} disabled={saving}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:bg-primary-300 transition-colors">
                        <Save className="w-3 h-3" /> {saving ? "저장중…" : "저장"}
                      </button>
                      <button onClick={cancelEdit} disabled={saving}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors">
                        <X className="w-3 h-3" /> 취소
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* 판정 결과: 확정 유형 + AI유형(3단계) + 근거 */}
              <div className="mb-4 bg-white border border-gray-200 rounded-lg border-l-4 border-l-purple-500 p-4">
                <div className="text-xs font-bold text-gray-500 mb-2">공공누리 유형 판정</div>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={typeForm}
                      onChange={(e) => setTypeForm(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">미판정</option>
                      {KOGL_TYPE_ORDER.map((t) => (
                        <option key={t} value={t}>{KOGL_TYPES[t].label} · {KOGL_TYPES[t].description}</option>
                      ))}
                    </select>
                    <label className={`inline-flex items-center gap-1.5 text-sm ${typeForm === "KOGL-0" ? "text-gray-300" : "text-gray-700"}`}>
                      AI 활용
                      <select
                        value={typeForm === "KOGL-0" ? "unknown" : aiForm}
                        disabled={typeForm === "KOGL-0"}
                        onChange={(e) => setAiForm(e.target.value as AiStatus)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="usable">활용 가능</option>
                        <option value="not_usable">활용 불가</option>
                        <option value="unknown">판단 불가</option>
                      </select>
                    </label>
                    {typeForm === "KOGL-0" && <span className="text-xs text-gray-400">제0유형은 AI유형 해당 없음</span>}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeBadge type={w.resolved_type} />
                    {isKoglType(w.resolved_type) && w.resolved_type !== "KOGL-0" && (
                      <AiBadge status={w.ai_type_applied as boolean | null | undefined} />
                    )}
                    {w.type_low_confidence === true && <span className="text-xs text-amber-600 font-medium">⚠ 자동 추정 · 확인 권장</span>}
                    {typeof w.type_reason === "string" && w.type_reason && (
                      <span className="text-xs text-gray-500">· {w.type_reason}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {WORK_GROUPS.map((section) => (
                  <div key={section.title} className={`bg-white border border-gray-200 rounded-lg overflow-hidden border-l-4 ${section.color}`}>
                    <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-700">{section.title}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-[140px]">항목</th>
                            <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">값</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.fields.map(([k, label]) => (
                            <tr key={k} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                              <td className="px-4 py-2 text-sm text-gray-500 font-medium align-top">{label}</td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {editing ? (
                                  <input
                                    value={form[k] ?? ""}
                                    onChange={(e) => setForm((prev) => ({ ...prev, [k]: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="미식별"
                                  />
                                ) : isMeaningful(w[k]) ? <MetaValue value={w[k]} /> : <span className="text-gray-400 italic">미식별</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const WORK_TYPE_LABELS: Record<string, string> = { image: "이미지", text: "텍스트", audio: "오디오", video: "영상" }
