"use client"

import { useState, useMemo, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { getContracts } from "@/lib/mock/data"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { Contract, KoglType, ContractStatus } from "@/types"
import { Plus, FileText, Search, Loader2 } from "lucide-react"

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
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

      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("계약서 로드 실패:", error.message)
        setAllContracts([])
      } else {
        setAllContracts(data || [])
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  return (
    <AppLayout>
      <div>
        {/* 상단 영역: 타이틀 + 검색 */}
        <div className="flex items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-900 flex-shrink-0">검사하기</h2>
          <div className="flex items-center gap-2 max-w-md w-full">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="검사명, 파일명으로 검색"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              검색
            </button>
          </div>
        </div>

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

        {/* 카드 그리드 - 4열, 꽉 차게 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* 새 문서 업로드 카드 */}
          <button
            onClick={() => router.push("/works/new")}
            className="flex flex-col items-center justify-center gap-3 bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-accent-400 hover:bg-accent-50/30 transition-colors cursor-pointer min-h-[200px]"
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <Plus className="w-7 h-7 text-gray-400" />
            </div>
            <span className="text-base font-semibold text-gray-600">
              새 검사 시작
            </span>
          </button>

          {/* 계약서별 카드 */}
          {contracts.map((contract) => (
            <button
              key={contract.id}
              onClick={() => router.push(`/works/${contract.id}`)}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition p-6 text-left cursor-pointer min-h-[200px] flex flex-col"
            >
              {/* 검사명 */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-4.5 h-4.5 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-gray-900 truncate">
                    {contract.inspection_title
                      ?? (contract.contract_filename
                        ? (contract.contract_filename.length > 20
                          ? contract.contract_filename.slice(0, 20) + "..."
                          : contract.contract_filename)
                        : "(파일 없음)")}
                  </p>
                </div>
              </div>

              {/* 유형분류결과 / 저작물 유형 */}
              <div className="flex items-center justify-between mb-2">
                {contract.gongnuri_type ? (
                  <KoglBadge type={contract.gongnuri_type} />
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                    미분류
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {getWorkTypes(contract)}
                </span>
              </div>

              {/* 검사 상태 */}
              <div className="mb-3">
                <StatusBadge status={contract.status} />
              </div>

              {/* 저작물 건수 / 날짜 */}
              <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                <span>저작물 {contract.works_count ?? 0}건</span>
                <span>{formatDateTime(contract.created_at)}</span>
              </div>
            </button>
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

function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: meta.color + "18",
        color: meta.color,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  )
}
