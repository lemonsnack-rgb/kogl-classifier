"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { DOCUMENT_TYPES } from "@/lib/api"
import { ScrollText, Upload } from "lucide-react"

export default function RightsNewPage() {
  const router = useRouter()
  const [inputMode, setInputMode] = useState<"file" | "text">("file")
  const [file, setFile] = useState<File | null>(null)
  const [inspectionName, setInspectionName] = useState("")
  const [text, setText] = useState("")
  const [docType, setDocType] = useState<string>("계약서")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const PIPELINE_URL = process.env.NEXT_PUBLIC_PIPELINE_URL || "https://ilwang-kogl-pipeline.hf.space"

  async function createRow(fileName: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("로그인이 필요합니다.")
    const { data: inserted, error: insErr } = await supabase
      .from("rights_checks")
      .insert({ user_id: user.id, status: "uploaded", file_name: fileName })
      .select("id").single()
    if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)
    return inserted.id as string
  }

  async function handleRunFile() {
    setError("")
    if (!inspectionName.trim()) { setError("검사 명칭을 입력하세요."); return }
    if (!file) { setError("PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const id = await createRow(inspectionName.trim())
      const fd = new FormData()
      fd.append("rights_check_id", id)
      fd.append("document_type", docType)
      fd.append("file", file)
      fetch(`${PIPELINE_URL}/process-rights`, { method: "POST", body: fd })
        .catch((e) => console.error("파이프라인 오류:", e))
      router.push(`/rights/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류"); setBusy(false)
    }
  }

  async function handleRunText() {
    setError("")
    if (!text.trim()) { setError("계약서 본문 텍스트를 입력하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const label = `텍스트 입력 · ${docType}`
      const id = await createRow(label)
      const fd = new FormData()
      fd.append("rights_check_id", id)
      fd.append("document_type", docType)
      fd.append("text", text)
      fetch(`${PIPELINE_URL}/process-rights`, { method: "POST", body: fd })
        .catch((e) => console.error("파이프라인 오류:", e))
      router.push(`/rights/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류"); setBusy(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          icon={ScrollText}
          title="새 권리추정"
          description="계약서를 업로드하거나 본문 텍스트를 입력해 권리유형을 추정합니다."
          backHref="/rights"
          backLabel="권리추정 목록"
        />

        {/* 입력 카드 */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            <button type="button" onClick={() => setInputMode("file")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                inputMode === "file" ? "border-accent-600 text-accent-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              파일 업로드
            </button>
            <button type="button" onClick={() => setInputMode("text")}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                inputMode === "text" ? "border-accent-600 text-accent-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              텍스트 입력
            </button>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">문서 유형</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white">
                {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            {inputMode === "file" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    검사 명칭 <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={inspectionName}
                    onChange={(e) => setInspectionName(e.target.value)}
                    placeholder="예: 2026년 콘텐츠 저작권 양도계약 검토"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    PDF 파일 <span className="text-red-500">*</span>
                  </label>
                  <input type="file" accept=".pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm" />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">계약서 본문 텍스트</label>
                <textarea value={text} onChange={(e) => setText(e.target.value)}
                  placeholder="계약서 본문 텍스트를 붙여넣으세요."
                  rows={12}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500" />
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end pt-2">
              <button onClick={inputMode === "file" ? handleRunFile : handleRunText} disabled={busy}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-accent-600 rounded-lg hover:bg-accent-700 disabled:bg-accent-400 transition-colors">
                <Upload className="w-4 h-4" />
                {busy ? "처리중..." : "권리추정 실행"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
