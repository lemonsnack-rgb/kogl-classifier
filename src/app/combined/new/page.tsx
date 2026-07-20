"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { DOCUMENT_TYPES } from "@/lib/api"
import { Layers, X } from "lucide-react"

export default function CombinedNewPage() {
  const router = useRouter()
  const [inspectionName, setInspectionName] = useState("")
  const [docType, setDocType] = useState<string>("계약서")
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [workFiles, setWorkFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function handleRun() {
    setError("")
    if (!inspectionName.trim()) { setError("검사 명칭을 입력하세요."); return }
    if (!contractFile) { setError("계약서 PDF 파일을 선택하세요."); return }
    if (!isSupabaseConfigured()) { setError("Supabase 설정이 필요합니다."); return }
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError("로그인이 필요합니다."); setBusy(false); return }

      const title = inspectionName.trim()
      const { data: inserted, error: insErr } = await supabase
        .from("rights_checks")
        .insert({ user_id: user.id, status: "uploaded", file_name: title, model_info: { mode: "combined" } })
        .select("id").single()
      if (insErr || !inserted) throw new Error(`기록 생성 실패: ${insErr?.message}`)

      const PIPELINE_URL = process.env.NEXT_PUBLIC_PIPELINE_URL || "https://ilwang-kogl-pipeline.hf.space"
      const fd = new FormData()
      fd.append("rights_check_id", inserted.id)
      fd.append("document_type", docType)
      fd.append("contract", contractFile)
      for (const wf of workFiles) fd.append("works", wf)
      fetch(`${PIPELINE_URL}/process-combined`, { method: "POST", body: fd })
        .catch((e) => console.error("파이프라인 오류:", e))

      router.push(`/combined/${inserted.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류")
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          icon={Layers}
          title="새 통합 검사"
          description="계약서와 저작물 파일을 업로드하면 메타데이터 추출 · 공공누리 유형 · 권리 판정을 한 화면에서 제공합니다."
          backHref="/combined"
          backLabel="통합 검사 목록"
        />

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">문서 유형</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-white">
              {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              검사 명칭 <span className="text-red-500">*</span>
            </label>
            <input type="text" value={inspectionName}
              onChange={(e) => setInspectionName(e.target.value)}
              placeholder="예: 2026년 콘텐츠 저작권 양도계약 통합검토"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              계약서 파일 <span className="text-red-500">*</span>
            </label>
            <input type="file" accept=".pdf" onChange={(e) => setContractFile(e.target.files?.[0] || null)} className="text-sm" />
            <p className="text-xs text-gray-400 mt-1">계약서 추출정보 · 공공누리 유형 · 권리 판정에 사용됩니다.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              저작물 파일 <span className="text-xs text-gray-400 font-normal">(선택, 복수 가능)</span>
            </label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.tiff" multiple
              onChange={(e) => setWorkFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} className="text-sm" />
            <p className="text-xs text-gray-400 mt-1">저작물별 메타데이터(20항목) 추출에 사용됩니다.</p>
            {workFiles.length > 0 && (
              <ul className="mt-2 space-y-1">
                {workFiles.map((w, i) => (
                  <li key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-1.5">
                    <span className="truncate">{w.name}</span>
                    <button onClick={() => setWorkFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end pt-2">
            <button onClick={handleRun} disabled={busy}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-accent-600 rounded-lg hover:bg-accent-700 disabled:bg-accent-400 transition-colors">
              <Layers className="w-4 h-4" />
              {busy ? "처리중..." : "통합 검사 실행"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
