"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import { NewRecordCard, RecordCard, StatusBadge } from "@/components/ui/RecordCard"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { RightsCheckStatus, RightsSummary } from "@/lib/api/rights-types"
import { Layers } from "lucide-react"

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
        <PageHeader
          icon={Layers}
          title="통합 검사"
          description="메타데이터 추출 · 공공누리 유형 · 권리 판정을 한 화면에서 제공합니다."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <NewRecordCard label="새 통합 검사" onClick={() => router.push("/combined/new")} />

          {rows.map((r) => (
            <RecordCard
              key={r.id}
              icon={Layers}
              title={r.file_name || r.id}
              onClick={() => router.push(`/combined/${r.id}`)}
              badges={
                r.status === "completed" ? (
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
                )
              }
              status={<StatusBadge label={STATUS_META[r.status].label} color={STATUS_META[r.status].color} />}
              footerLeft={`근거 ${r.summary?.evidence_count ?? 0}건`}
              footerRight={formatDate(r.created_at)}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
