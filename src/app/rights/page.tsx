"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import ListSearch from "@/components/ui/ListSearch"
import { NewRecordCard, RecordCard, StatusBadge } from "@/components/ui/RecordCard"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { RightsCheckStatus, RightsSummary } from "@/lib/api/rights-types"
import { ScrollText } from "lucide-react"

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

function RightsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [rows, setRows] = useState<RightsCheckRow[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setSuccessMsg("권리추정이 접수되었습니다. 처리 완료 시 목록에서 자동으로 갱신됩니다.")
      const t = setTimeout(() => setSuccessMsg(null), 6000)
      return () => clearTimeout(t)
    }
  }, [searchParams])

  const loadRows = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    const { data } = await supabase
      .from("rights_checks")
      .select("id, file_name, status, summary, created_at, model_info")
      .order("created_at", { ascending: false })
      .limit(100)
    // 통합(mode=combined) 기록은 권리추정 목록에서 제외
    const filtered = ((data as (RightsCheckRow & { model_info?: { mode?: string } })[]) || [])
      .filter((r) => r.model_info?.mode !== "combined")
      .slice(0, 50)
    setRows(filtered)
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

  const visibleRows = activeQuery.trim()
    ? rows.filter((r) => (r.file_name || r.id).toLowerCase().includes(activeQuery.toLowerCase()))
    : rows

  return (
    <AppLayout>
      <div>
        <PageHeader
          icon={ScrollText}
          title="권리추정"
          description="계약서 본문에서 저작재산권·이용조건 등 권리 판정을 추정합니다."
          right={
            <ListSearch value={searchQuery} onChange={setSearchQuery} onSearch={() => setActiveQuery(searchQuery)} />
          }
        />

        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-700 font-medium">✓ {successMsg}</p>
          </div>
        )}

        {/* 카드 그리드 (3메뉴 공통) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <NewRecordCard label="새 권리추정" onClick={() => router.push("/rights/new")} />

          {visibleRows.map((r) => (
            <RecordCard
              key={r.id}
              icon={ScrollText}
              title={r.file_name || r.id}
              onClick={() => router.push(`/rights/${r.id}`)}
              badges={
                r.status === "completed" && r.summary ? (
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
                )
              }
              status={
                <StatusBadge
                  label={RIGHTS_STATUS_META[r.status].label}
                  color={RIGHTS_STATUS_META[r.status].color}
                />
              }
              footerLeft={`근거 ${r.summary?.evidence_count ?? 0}건`}
              footerRight={formatDate(r.created_at)}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

export default function RightsPage() {
  return (
    <Suspense fallback={<AppLayout><div className="py-12 text-center text-sm text-gray-500">로딩 중…</div></AppLayout>}>
      <RightsPageInner />
    </Suspense>
  )
}
