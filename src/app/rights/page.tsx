"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { DOCUMENT_TYPES } from "@/lib/api"
import type { RightsCheckStatus, RightsSummary } from "@/lib/api/rights-types"
import { ScrollText, Upload } from "lucide-react"

interface RightsCheckRow {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  summary: RightsSummary | null
  created_at: string
}

const RIGHTS_STATUS_META: Record<RightsCheckStatus, { label: string; color: string }> = {
  uploaded: { label: "업로드됨", color: "#3B82F6" },
  ocr_processing: { label: "OCR 처리중", color: "#3B82F6" },
  predicting: { label: "권리추정중", color: "#F59E0B" },
  completed: { label: "완료", color: "#10B981" },
  failed: { label: "실패", color: "#EF4444" },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function RightsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<RightsCheckRow[]>([])
  const [inputMode, setInputMode] = useState<"file" | "text">("file")
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState("")
  const [docType, setDocType] = useState<string>("계약서")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const loadRows = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data } = await supabase
      .from("rights_checks")
      .select("id, file_name, status, summary, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
    setRows((data as RightsCheckRow[]) || [])
  }, [])

  useEffect(() => { loadRows() }, [loadRows])

  // 처리 중인 건이 있으면 10초마다 갱신 (검사하기와 동일 패턴)
  useEffect(() => {
    const hasProcessing = rows.some((r) =>
      ["uploaded", "ocr_processing", "predicting"].includes(r.status)
    )
    if (!hasProcessing) return
    const interval = setInterval(loadRows, 10000)
    return () => clearInterval(interval)
  }, [rows, loadRows])

  // rights_checks 행 생성 후 파이프라인 실행 + 이동 (파일/텍스트 공통)
  async function runProcess(insertPayload: Record<string, unknown>, processPayload: Record<string, unknown>) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("로그인이 필요합니다."); setBusy(false); return }

    const { data: inserted, error: insErr } = await supabase
      .from("rights_checks")
      .insert({ user_id: user.id, status: "uploaded", ...insertPayload })
      .select("id").single()
    if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)

    const res = await fetch("/api/rights/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rightsCheckId: inserted.id, ...processPayload }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => null)
      throw new Error(e?.error || `처리 실패: ${res.status}`)
    }
    router.push(`/rights/${inserted.id}`)
  }

  async function handleRunFile() {
    setError("")
    if (!file) { setError("PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("로그인이 필요합니다."); setBusy(false); return }

      // 1) 파일 업로드 (기존 contracts 버킷 재사용)
      const ext = file.name.split(".").pop() || "pdf"
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file)
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)
      const { data: pub } = supabase.storage.from("contracts").getPublicUrl(path)

      // 2) rights_checks 행 생성 + 3) 파이프라인 실행
      await runProcess(
        { file_name: file.name, file_url: pub.publicUrl },
        { fileUrl: pub.publicUrl, fileName: file.name, documentType: docType },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
    } finally {
      setBusy(false)
    }
  }

  async function handleRunText() {
    setError("")
    if (!text.trim()) { setError("계약서 본문 텍스트를 입력하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const label = text.trim().slice(0, 40) || "텍스트 입력"
      await runProcess(
        { file_name: label, file_url: null },
        { text, fileName: label, documentType: docType },
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <div>
        {/* 타이틀 */}
        <div className="flex items-center gap-2 mb-6">
          <ScrollText className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-bold text-gray-900">권리추정</h2>
        </div>

        {/* 입력 카드 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-8 max-w-3xl">
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            <button type="button" onClick={() => setInputMode("file")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                inputMode === "file" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              파일 업로드
            </button>
            <button type="button" onClick={() => setInputMode("text")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                inputMode === "text" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              텍스트 입력
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">문서 유형</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {inputMode === "file" ? (
              <div>
                <label className="block text-sm text-gray-500 mb-1">PDF 파일</label>
                <input type="file" accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
              </div>
            ) : (
              <div>
                <label className="block text-sm text-gray-500 mb-1">계약서 본문 텍스트</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="계약서 본문 텍스트를 붙여넣으세요."
                  rows={10}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={inputMode === "file" ? handleRunFile : handleRunText} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {busy ? "처리중..." : "권리추정 실행"}
            </button>
          </div>
        </div>

        {/* 최근 기록 — 카드 그리드 (검사하기와 동일 형태) */}
        <h3 className="text-base font-bold text-gray-700 mb-3">최근 기록</h3>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">기록이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => router.push(`/rights/${r.id}`)}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition p-6 text-left cursor-pointer min-h-[200px] flex flex-col"
              >
                {/* 파일명 */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ScrollText className="w-[18px] h-[18px] text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold text-gray-900 truncate">
                      {r.file_name || r.id}
                    </p>
                  </div>
                </div>

                {/* 권리 판정 요약 (완료 시) */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2 min-h-[22px]">
                  {r.status === "completed" && r.summary ? (
                    <>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        허용 {r.summary.safe}
                      </span>
                      {r.summary.review > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                          확인필요 {r.summary.review}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </div>

                {/* 상태 */}
                <div className="mb-3">
                  <StatusBadge status={r.status} />
                </div>

                {/* 근거 건수 / 날짜 */}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                  <span>근거 {r.summary?.evidence_count ?? 0}건</span>
                  <span>{formatDate(r.created_at)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}

function StatusBadge({ status }: { status: RightsCheckStatus }) {
  const meta = RIGHTS_STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: meta.color + "18", color: meta.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}
