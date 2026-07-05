"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { DOCUMENT_TYPES } from "@/lib/api"
import type { RightsCheckStatus } from "@/lib/api/rights-types"
import { ScrollText, Upload } from "lucide-react"

interface RightsCheckRow {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  created_at: string
}

const STATUS_LABEL: Record<RightsCheckStatus, string> = {
  uploaded: "업로드됨", ocr_processing: "OCR 처리중", predicting: "권리추정중",
  completed: "완료", failed: "실패",
}

export default function RightsPage() {
  const [rows, setRows] = useState<RightsCheckRow[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<string>("계약서")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function loadRows() {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data } = await supabase
      .from("rights_checks")
      .select("id, file_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
    setRows((data as RightsCheckRow[]) || [])
  }

  useEffect(() => { loadRows() }, [])

  async function handleRun() {
    setError("")
    if (!file) { setError("PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("로그인이 필요합니다."); setBusy(false); return }

      // 1) 파일 업로드 (기존 contracts 버킷 재사용)
      const path = `${user.id}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file)
      if (upErr) throw new Error(`업로드 실패: ${upErr.message}`)
      const { data: pub } = supabase.storage.from("contracts").getPublicUrl(path)

      // 2) rights_checks 행 생성
      const { data: inserted, error: insErr } = await supabase
        .from("rights_checks")
        .insert({ user_id: user.id, file_name: file.name, file_url: pub.publicUrl, status: "uploaded" })
        .select("id").single()
      if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)

      // 3) 파이프라인 실행
      const res = await fetch("/api/rights/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rightsCheckId: inserted.id, fileUrl: pub.publicUrl,
          fileName: file.name, documentType: docType,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        throw new Error(e?.error || `처리 실패: ${res.status}`)
      }
      window.location.href = `/rights/${inserted.id}`
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <ScrollText className="w-6 h-6 text-primary-600" />
          <h1 className="text-xl font-bold text-gray-900">권리추정</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">문서 유형</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">PDF 파일</label>
              <input type="file" accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={handleRun} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {busy ? "처리중..." : "권리추정 실행"}
            </button>
          </div>
        </div>

        <h2 className="text-base font-bold text-gray-700 mb-3">최근 기록</h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
                <th className="text-left px-4 py-2.5">파일명</th>
                <th className="text-left px-4 py-2.5 w-[120px]">상태</th>
                <th className="text-left px-4 py-2.5 w-[160px]">생성일</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">기록이 없습니다.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <Link href={`/rights/${r.id}`} className="text-primary-600 hover:underline">
                      {r.file_name || r.id}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{STATUS_LABEL[r.status] || r.status}</td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  )
}
