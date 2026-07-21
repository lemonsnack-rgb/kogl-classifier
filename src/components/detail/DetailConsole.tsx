"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Pencil, Save, X } from "lucide-react"
import { KOGL_TYPES, type KoglType } from "@/types"

/* ============================================================
   공용 상세 콘솔 — 검사하기·통합검사 공통 레이아웃
   헤더 + 좌우 2단(좌: 정보/목록, 우: 공유 상세 패널)
   저작물별 유형 + AI(3단계)를 배지로 병기하고 편집 지원
============================================================ */

export const KOGL_TYPE_ORDER: KoglType[] = ["KOGL-0", "KOGL-1", "KOGL-2", "KOGL-3", "KOGL-4"]
export type AiStatus = "usable" | "not_usable" | "unknown"

export function aiToStatus(v: unknown): AiStatus {
  if (v === true) return "usable"
  if (v === false) return "not_usable"
  return "unknown"
}
export function statusToAi(s: AiStatus): boolean | null {
  if (s === "usable") return true
  if (s === "not_usable") return false
  return null
}
export function isKoglType(v: unknown): v is KoglType {
  return typeof v === "string" && (KOGL_TYPE_ORDER as string[]).includes(v)
}

/* 유형 배지(제0~4, 라벨·설명) */
export function TypeBadge({ type }: { type: unknown }) {
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

/* AI유형 배지 3단계(제1~4에만 병기, 제0은 N/A) */
export function AiBadge({ status }: { status: boolean | null | undefined }) {
  if (status === true) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border border-indigo-300 text-indigo-700 bg-indigo-50">AI 활용 가능</span>
  }
  if (status === false) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border border-rose-200 text-rose-600 bg-rose-50">AI 활용 불가</span>
  }
  return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-200 text-gray-400 bg-gray-50">AI 판단 불가</span>
}

/* 유형 + AI 배지 병기(제1~4면 AI 함께, 제0은 유형만) */
export function TypeAiBadges({ resolvedType, ai }: { resolvedType: unknown; ai: boolean | null | undefined }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <TypeBadge type={resolvedType} />
      {isKoglType(resolvedType) && resolvedType !== "KOGL-0" && <AiBadge status={ai} />}
    </span>
  )
}

const WORK_TYPE_LABELS: Record<string, string> = { image: "이미지", text: "텍스트", audio: "오디오", video: "영상" }

/* 저작물 20항목 3범주 그룹 */
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
const WORK_FIELD_KEYS: string[] = WORK_GROUPS.flatMap((g) => g.fields.map(([k]) => k))

function toStr(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}
function isMeaningful(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === "string") { const t = v.trim(); return t !== "" && t !== "-" }
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === "object") return Object.keys(v as object).length > 0
  return true
}
function MetaValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, i) => (
          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">{String(item)}</span>
        ))}
      </div>
    )
  }
  if (value && typeof value === "object") return <span className="text-gray-900">{JSON.stringify(value)}</span>
  return <span className="text-gray-900">{String(value)}</span>
}

export interface DetailConsoleProps {
  title: string
  backHref: string
  backLabel: string
  /** 좌측 상단 페이지별 콘텐츠(계약서 기본정보, 대표유형(+AI), 통합의 권리 판정 등) */
  leftTop?: React.ReactNode
  /** 계약서 추출 메타데이터 우측 표시 노드(있으면 좌측에 [계약서 추출 메타데이터] 버튼 노출) */
  contractMetaNode?: React.ReactNode
  /** 저작물 배열(각 항목은 20필드 + resolved_type/ai_type_applied/type_reason/type_low_confidence + work_filename/work_type/id 를 top-level로 보유) */
  works: Record<string, unknown>[]
  /** 저작물 저장 콜백. index=대상, patch=변경필드, nextWorks=병합된 전체 배열(JSONB 저장용). 미제공 시 편집 불가 */
  onSaveWork?: (index: number, patch: Record<string, unknown>, nextWorks: Record<string, unknown>[]) => Promise<void>
  /** 저작물 목록 하단 부가 노드(엑셀 다운로드 등) */
  worksFooter?: React.ReactNode
  /** 저작물 우측 패널 헤더의 저작물별 액션(미리보기 등) */
  workActions?: (work: Record<string, unknown>, index: number) => React.ReactNode
}

export default function DetailConsole({
  title, backHref, backLabel, leftTop, contractMetaNode, works, onSaveWork, worksFooter, workActions,
}: DetailConsoleProps) {
  const [localWorks, setLocalWorks] = useState(works)
  const [sel, setSel] = useState<"contract" | number | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [typeForm, setTypeForm] = useState<string>("")
  const [aiForm, setAiForm] = useState<AiStatus>("unknown")
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  const isWork = typeof sel === "number"
  const w = isWork ? localWorks[sel] : null

  function selectContract() { setSel("contract"); setEditing(false); setSavedMsg(false) }
  function selectWork(i: number) { setSel(i); setEditing(false); setSavedMsg(false) }

  function startEdit() {
    if (!w) return
    const f: Record<string, string> = {}
    for (const k of WORK_FIELD_KEYS) f[k] = toStr(w[k])
    setForm(f)
    setTypeForm(isKoglType(w.resolved_type) ? w.resolved_type : "")
    setAiForm(aiToStatus(w.ai_type_applied))
    setEditing(true)
    setSavedMsg(false)
  }
  function cancelEdit() { setEditing(false); setForm({}) }

  async function save() {
    if (!isWork || !w || !onSaveWork) return
    const patch: Record<string, unknown> = {}
    for (const k of WORK_FIELD_KEYS) {
      const val = (form[k] ?? "").trim()
      if (k === "keywords") patch[k] = val ? val.split(",").map((s) => s.trim()).filter(Boolean) : null
      else patch[k] = val || null
    }
    patch.resolved_type = typeForm || null
    patch.ai_type_applied = typeForm === "KOGL-0" ? null : statusToAi(aiForm)
    const nextWorks = localWorks.map((x, i) => (i === sel ? { ...x, ...patch } : x))
    setSaving(true)
    try {
      await onSaveWork(sel, patch, nextWorks)
      setLocalWorks(nextWorks)
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
    <div className="flex flex-col h-[calc(100vh-24px)]">
      {/* 헤더 */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>

      {/* 좌우 2단 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌: 정보 + 목록 */}
        <div className="w-1/2 overflow-y-auto px-6 py-5 border-r border-gray-200 space-y-6">
          {leftTop}

          <div>
            <div className="text-[15px] font-bold text-gray-800 tracking-tight mb-3">계약서·저작물</div>
            <div className="space-y-1">
              {contractMetaNode && (
                <button
                  onClick={selectContract}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors relative ${
                    sel === "contract" ? "bg-primary-50 border border-primary-200" : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  {sel === "contract" && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-600 rounded-r" />}
                  <span className="flex-1 min-w-0 text-sm text-gray-900 font-medium truncate">계약서 추출 메타데이터</span>
                </button>
              )}
              <div className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400">저작물 ({localWorks.length}건)</div>
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
            {worksFooter && <div className="mt-3">{worksFooter}</div>}
          </div>
        </div>

        {/* 우: 공유 상세 패널 */}
        <div className="w-1/2 overflow-y-auto bg-gray-50 px-6 py-5">
          {sel === null ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-gray-400">좌측에서 계약서 또는 저작물을 선택하세요</p>
            </div>
          ) : sel === "contract" ? (
            <div>
              <h3 className="text-[15px] font-bold text-gray-800 tracking-tight mb-4">계약서 추출 메타데이터</h3>
              {contractMetaNode}
            </div>
          ) : w ? (
            <div>
              <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary-600 text-white text-xs font-bold flex-shrink-0">{(sel as number) + 1}</span>
                  <h3 className="text-sm font-semibold text-gray-800 truncate">{String(w.work_filename || `저작물 ${(sel as number) + 1}`)}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {savedMsg && <span className="text-xs text-green-600 font-medium">✓ 저장됨</span>}
                  {!editing && workActions && workActions(w, sel as number)}
                  {onSaveWork && (!editing ? (
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
                  ))}
                </div>
              </div>

              {/* 판정: 유형 + AI 병기(수정 시 드롭다운) */}
              <div className="mb-4 bg-white border border-gray-200 rounded-lg border-l-4 border-l-purple-500 p-4">
                <div className="text-xs font-bold text-gray-500 mb-2">공공누리 유형 판정</div>
                {editing ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <select value={typeForm} onChange={(e) => setTypeForm(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                      <option value="">미판정</option>
                      {KOGL_TYPE_ORDER.map((t) => (
                        <option key={t} value={t}>{KOGL_TYPES[t].label} · {KOGL_TYPES[t].description}</option>
                      ))}
                    </select>
                    <label className={`inline-flex items-center gap-1.5 text-sm ${typeForm === "KOGL-0" ? "text-gray-300" : "text-gray-700"}`}>
                      AI 활용
                      <select value={typeForm === "KOGL-0" ? "unknown" : aiForm} disabled={typeForm === "KOGL-0"}
                        onChange={(e) => setAiForm(e.target.value as AiStatus)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500">
                        <option value="usable">활용 가능</option>
                        <option value="not_usable">활용 불가</option>
                        <option value="unknown">판단 불가</option>
                      </select>
                    </label>
                    {typeForm === "KOGL-0" && <span className="text-xs text-gray-400">제0유형은 AI유형 해당 없음</span>}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <TypeAiBadges resolvedType={w.resolved_type} ai={w.ai_type_applied as boolean | null | undefined} />
                    {w.type_low_confidence === true && <span className="text-xs text-amber-600 font-medium">⚠ 자동 추정 · 확인 권장</span>}
                    {typeof w.type_reason === "string" && w.type_reason && <span className="text-xs text-gray-500">· {w.type_reason}</span>}
                  </div>
                )}
              </div>

              {/* 20항목 3범주 */}
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
                                {editing && k !== "creator" ? (
                                  <input value={form[k] ?? ""} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    placeholder="미식별" />
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
