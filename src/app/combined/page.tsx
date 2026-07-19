"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { RightsCheckStatus, RightsSummary } from "@/lib/api/rights-types"
import { Layers, Plus } from "lucide-react"

interface Row {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  summary: RightsSummary | null
  created_at: string
  model_info?: { mode?: string; type?: { predicted_type?: string } | null } | null
}

const STATUS_META: Record<RightsCheckStatus, { label: string; color: string }> = {
  uploaded: { label: "업로드됨", color: "#3B82F6" },
  ocr_processing: { label: "OCR 처리중", color: "#3B82F6" },
  predicting: { label: "분석중", color: "#F59E0B" },
  completed: { label: "완료", color: "#10B981" },
  failed: { label: "실패", color: "#EF4444" },
}

const TYPE_LABEL: Record<string, string> = { "유형1": "제1유형", "유형2": "제2유형", "유형3": "제3유형", "유형4": "제4유형" }

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function CombinedPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])

  const loadRows = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data } = await supabase
      .from("rights_checks")
      .select("id, file_name, status, summary, created_at, model_info")
      .order("created_at", { ascending: false })
      .limit(100)
    const filtered = ((data as Row[]) || []).filter((r) => r.model_info?.mode === "combined").slice(0, 50)
    setRows(filtered)
  }, [])

  useEffect(() => { loadRows() }, [loadRows])

  useEffect(() => {
    const processing = rows.some((r) => ["uploaded", "ocr_processing", "predicting"].includes(r.status))
    if (!processing) return
    const t = setInterval(loadRows, 10000)
    return () => clearInterval(t)
  }, [rows, loadRows])

  return (
    <AppLayout>
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Layers className="w-6 h-6 text-primary-600" />
          <h2 className="text-xl font-bold text-gray-900">통합 검사</h2>
          <span className="text-sm text-gray-400">메타데이터 · 공공누리 유형 · 권리 판정</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <button
            onClick={() => router.push("/combined/new")}
            className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-accent-400 hover:bg-accent-50/30 transition-colors cursor-pointer min-h-[200px]"
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus className="w-7 h-7 text-gray-400" />
            </div>
            <span className="text-base font-semibold text-gray-600">새 통합 검사</span>
          </button>

          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => router.push(`/combined/${r.id}`)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition p-6 text-left cursor-pointer min-h-[200px] flex flex-col"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Layers className="w-[18px] h-[18px] text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-gray-900 truncate">{r.file_name || r.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mb-2 min-h-[22px]">
                {r.status === "completed" ? (
                  <>
                    {r.model_info?.type?.predicted_type && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white bg-primary-700">
                        {TYPE_LABEL[r.model_info.type.predicted_type] || r.model_info.type.predicted_type}
                      </span>
                    )}
                    {r.summary && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        허용 {r.summary.safe}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )}
              </div>

              <div className="mb-3">
                <StatusBadge status={r.status} />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                <span>근거 {r.summary?.evidence_count ?? 0}건</span>
                <span>{formatDate(r.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

function StatusBadge({ status }: { status: RightsCheckStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: meta.color + "18", color: meta.color }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: meta.color }} />
      {meta.label}
    </span>
  )
}
