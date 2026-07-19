"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import ListSearch from "@/components/ui/ListSearch"
import { NewRecordCard, RecordCard, StatusBadge } from "@/components/ui/RecordCard"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { Contract, KoglType } from "@/types"
import { FileText, Loader2 } from "lucide-react"

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** 저작물 유형 목록에서 대표 유형 추출 */
function getWorkTypes(contract: { works?: { work_type: string | null }[] }): string {
  const types = new Set<string>()
  contract.works?.forEach(w => {
    if (w.work_type) types.add(WORK_TYPE_LABELS[w.work_type] ?? w.work_type)
  })
  return types.size > 0 ? Array.from(types).join(", ") : "-"
}

const WORK_TYPE_LABELS: Record<string, string> = {
  image: "이미지",
  text: "텍스트",
  audio: "오디오",
  video: "영상",
}

export default function WorksPageWrapper() {
  return (
    <Suspense fallback={<AppLayout><div className="flex items-center justify-center py-12"><span className="text-sm text-gray-500">로딩 중...</span></div></AppLayout>}>
      <WorksPage />
    </Suspense>
  )
}

function WorksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [allContracts, setAllContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // 업로드 성공 메시지 표시
  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setSuccessMsg("검사가 등록되었습니다.")
      const timer = setTimeout(() => setSuccessMsg(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeQuery, setActiveQuery] = useState("")

  // Supabase에서 실제 데이터 로드
  const loadContracts = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setAllContracts([])
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setAllContracts([])
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
      const isAdmin = profile?.role === "admin"

      let query = supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false })

      if (!isAdmin) {
        query = query.eq("user_id", user.id)
      }

      const { data, error } = await query

      if (error) {
        console.error("계약서 로드 실패:", error.message)
        setAllContracts([])
      } else {
        const contracts = data || []
        const userIds = Array.from(new Set(contracts.map((c) => c.user_id).filter(Boolean)))
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, organization")
            .in("id", userIds)
          const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
          setAllContracts(
            contracts.map((c) => ({ ...c, profile: profileMap.get(c.user_id) || undefined }))
          )
        } else {
          setAllContracts(contracts)
        }
      }
    } catch {
      setAllContracts([])
    }
    setLoading(false)
  }, [])

  // 초기 로드
  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  // 자동 폴링: 처리 중인 건이 있으면 10초마다 갱신
  useEffect(() => {
    const hasProcessing = allContracts.some((c) =>
      ["uploaded", "ocr_processing", "classifying"].includes(c.status)
    )
    if (!hasProcessing) return
    const interval = setInterval(loadContracts, 10000)
    return () => clearInterval(interval)
  }, [allContracts, loadContracts])

  const contracts = useMemo(() => {
    if (!activeQuery.trim()) return allContracts
    const q = activeQuery.toLowerCase()
    return allContracts.filter(
      (c) =>
        (c.inspection_title && c.inspection_title.toLowerCase().includes(q)) ||
        (c.contract_filename && c.contract_filename.toLowerCase().includes(q))
    )
  }, [allContracts, activeQuery])

  const handleSearch = () => {
    setActiveQuery(searchQuery)
  }

  return (
    <AppLayout>
      <div>
        <PageHeader
          icon={FileText}
          title="검사하기"
          description="계약서·저작물을 업로드해 공공누리 유형을 자동 분류합니다."
          right={
            <ListSearch value={searchQuery} onChange={setSearchQuery} onSearch={handleSearch} />
          }
        />

        {/* 성공 메시지 */}
        {successMsg && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-700 font-medium">✓ {successMsg}</p>
          </div>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">데이터를 불러오는 중...</span>
          </div>
        )}

        {/* 카드 그리드 (3메뉴 공통) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <NewRecordCard label="새 검사 시작" onClick={() => router.push("/works/new")} />

          {contracts.map((contract) => (
            <RecordCard
              key={contract.id}
              icon={FileText}
              title={
                contract.inspection_title
                ?? (contract.contract_filename
                  ? (contract.contract_filename.length > 20
                    ? contract.contract_filename.slice(0, 20) + "..."
                    : contract.contract_filename)
                  : "(파일 없음)")
              }
              onClick={() => router.push(`/works/${contract.id}`)}
              badges={
                <div className="flex items-center justify-between w-full">
                  {contract.gongnuri_type ? (
                    <KoglBadge type={contract.gongnuri_type} />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                      미분류
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{getWorkTypes(contract)}</span>
                </div>
              }
              status={<StatusBadge label={STATUS_META[contract.status].label} color={STATUS_META[contract.status].color} />}
              footerLeft={`저작물 ${contract.works_count ?? 0}건`}
              footerRight={(contract.profile?.name || contract.user_id) + " │ " + formatDate(contract.created_at)}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

/* ====================================================
   Sub Components
==================================================== */

function KoglBadge({ type }: { type: KoglType }) {
  const meta = KOGL_TYPES[type]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}
