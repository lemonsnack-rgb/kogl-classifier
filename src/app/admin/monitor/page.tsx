"use client"

import { useState, useEffect, useCallback } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"
import { STATUS_META, KOGL_TYPES } from "@/types"
import type { ContractStatus, KoglType } from "@/types"
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

interface PipelineLog {
  step: string
  status: string
  detail: string
  timestamp: string
}

interface MonitorItem {
  id: string
  inspection_title: string | null
  contract_filename: string | null
  contract_file_url: string | null
  document_type: string | null
  status: ContractStatus
  gongnuri_type: KoglType | null
  gongnuri_confidence: number | null
  pipeline_log: PipelineLog[] | null
  user_id: string
  user_name: string
  user_org: string
  created_at: string
  updated_at: string
}

const POLL_INTERVAL = 10000 // 10초

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}

function LogIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
  if (status === "failed") return <XCircle className="w-3.5 h-3.5 text-red-500" />
  if (status === "processing") return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
  return <Clock className="w-3.5 h-3.5 text-gray-400" />
}

export default function AdminMonitorPage() {
  const [items, setItems] = useState<MonitorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [lastRefresh, setLastRefresh] = useState<string>("")

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from("contracts")
        .select("id, inspection_title, contract_filename, contract_file_url, document_type, status, gongnuri_type, gongnuri_confidence, pipeline_log, user_id, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        console.error("모니터링 데이터 로드 실패:", error)
        setLoading(false)
        return
      }

      // 프로필 조회
      const userIds = Array.from(new Set((data || []).map((d) => d.user_id)))
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, organization")
        .in("id", userIds)

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      )

      const monitorItems: MonitorItem[] = (data || []).map((d) => {
        const profile = profileMap.get(d.user_id)
        return {
          ...d,
          pipeline_log: d.pipeline_log || null,
          user_name: profile?.name || "-",
          user_org: profile?.organization || "-",
        }
      })

      setItems(monitorItems)
      setLastRefresh(formatDateTime(new Date().toISOString()))
    } catch (err) {
      console.error("모니터링 오류:", err)
    }
    setLoading(false)
  }, [])

  // 초기 로드
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // 자동 폴링
  useEffect(() => {
    if (!polling) return
    const interval = setInterval(fetchData, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [polling, fetchData])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 삭제
  const handleDelete = async (contractId: string) => {
    if (!confirm("이 검사 건을 삭제하시겠습니까? 관련 저작물, 근거 조항도 함께 삭제됩니다.")) return

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        // 관련 데이터 삭제 (순서 중요: FK 참조 순)
        await supabase.from("contract_clauses").delete().eq("contract_id", contractId)
        await supabase.from("works").delete().eq("contract_id", contractId)
        await supabase.from("contracts").delete().eq("id", contractId)
      } catch (err) {
        alert("삭제 중 오류: " + (err instanceof Error ? err.message : "알 수 없는 오류"))
        return
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== contractId))
  }

  // 재검사
  const handleReprocess = async (item: MonitorItem) => {
    if (!confirm(`"${item.inspection_title || item.contract_filename}" 건을 재검사하시겠습니까? 기존 결과는 초기화됩니다.`)) return

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()

        // 기존 결과 초기화
        await supabase.from("contract_clauses").delete().eq("contract_id", item.id)
        await supabase.from("contracts").update({
          status: "uploaded",
          gongnuri_type: null,
          gongnuri_confidence: null,
          gongnuri_evidence: null,
          contract_metadata: null,
          ocr_text: null,
          pipeline_log: [],
        }).eq("id", item.id)

        // 파일 다운로드 → 파이프라인 호출
        if (item.contract_file_url) {
          const bucket = "contracts"
          const { data: fileData } = await supabase.storage.from(bucket).download(item.contract_file_url)

          if (fileData) {
            const PIPELINE_URL = "https://ilwang-kogl-pipeline.hf.space"
            const form = new FormData()
            form.append("file", fileData, item.contract_filename || "document.pdf")
            form.append("contract_id", item.id)
            form.append("document_type", item.document_type || "기타문서")
            form.append("file_name", item.contract_filename || "document.pdf")

            fetch(`${PIPELINE_URL}/process`, { method: "POST", body: form })
              .catch((err) => console.error("재검사 오류:", err))

            alert("재검사가 시작되었습니다. 2~3분 후 결과가 업데이트됩니다.")
          } else {
            alert("파일 다운로드 실패. 원본 파일이 삭제되었을 수 있습니다.")
          }
        } else {
          alert("파일 정보가 없어 재검사할 수 없습니다.")
        }
      } catch (err) {
        alert("재검사 오류: " + (err instanceof Error ? err.message : "알 수 없는 오류"))
      }
    }
    fetchData()
  }

  const filteredItems = statusFilter === "all"
    ? items
    : items.filter((i) => i.status === statusFilter)

  // 통계
  const stats = {
    total: items.length,
    processing: items.filter((i) => ["uploaded", "ocr_processing", "classifying"].includes(i.status)).length,
    completed: items.filter((i) => i.status === "completed").length,
    failed: items.filter((i) => i.status === "failed").length,
    review: items.filter((i) => i.status === "review_required").length,
  }

  return (
    <AppLayout>
      <div className="max-w-6xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">검사 모니터링</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {lastRefresh && `마지막 갱신: ${lastRefresh}`}
              {polling && " · 10초 자동 갱신 중"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={polling}
                onChange={(e) => setPolling(e.target.checked)}
                className="rounded border-gray-300"
              />
              자동 갱신
            </label>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              새로고침
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: "전체", value: stats.total, color: "text-gray-900", bg: "bg-gray-50" },
            { label: "처리중", value: stats.processing, color: "text-blue-700", bg: "bg-blue-50" },
            { label: "완료", value: stats.completed, color: "text-green-700", bg: "bg-green-50" },
            { label: "실패", value: stats.failed, color: "text-red-700", bg: "bg-red-50" },
            { label: "검토필요", value: stats.review, color: "text-amber-700", bg: "bg-amber-50" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-lg px-4 py-3`}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 필터 */}
        <div className="flex gap-2 mb-4">
          {["all", "uploaded", "ocr_processing", "classifying", "completed", "review_required", "failed"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                statusFilter === s
                  ? "bg-primary-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s === "all" ? "전체" : STATUS_META[s as ContractStatus]?.label || s}
            </button>
          ))}
        </div>

        {/* 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">데이터 없음</div>
          ) : (
            <div>
              {/* 헤더 */}
              <div className="grid grid-cols-[32px_1fr_120px_90px_80px_140px_100px] gap-0 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
                <div />
                <div className="text-xs font-medium text-gray-500">검사명</div>
                <div className="text-xs font-medium text-gray-500">등록자</div>
                <div className="text-xs font-medium text-gray-500">상태</div>
                <div className="text-xs font-medium text-gray-500">유형</div>
                <div className="text-xs font-medium text-gray-500">등록일</div>
                <div className="text-xs font-medium text-gray-500">관리</div>
              </div>

              {/* 행 */}
              {filteredItems.map((item) => {
                const isExpanded = expandedIds.has(item.id)
                const logs = item.pipeline_log || []
                const isProcessingStatus = ["ocr_processing", "classifying"].includes(item.status)
                const minutesSinceUpdate = (Date.now() - new Date(item.updated_at).getTime()) / 60000
                const isTimedOut = isProcessingStatus && minutesSinceUpdate > 5
                const isProcessing = isProcessingStatus && !isTimedOut

                return (
                  <div key={item.id} className="border-b border-gray-100">
                    {/* 메인 행 */}
                    <div
                      className="grid grid-cols-[32px_1fr_120px_90px_80px_140px_100px] gap-0 items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleExpand(item.id)}
                    >
                      <div>
                        {logs.length > 0 ? (
                          isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
                        ) : (
                          <span className="w-4 h-4 block" />
                        )}
                      </div>
                      <div className="text-sm text-gray-900 font-medium truncate pr-2">
                        <div className="flex items-center gap-2">
                          {isProcessing && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />}
                          <span className="truncate">{item.inspection_title || item.contract_filename || "-"}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 truncate">{item.user_org} {item.user_name}</div>
                      <div>
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: (STATUS_META[item.status]?.color || "#999") + "18",
                            color: STATUS_META[item.status]?.color || "#999",
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isTimedOut ? "#EF4444" : (STATUS_META[item.status]?.color || "#999") }} />
                          {isTimedOut ? "타임아웃" : (STATUS_META[item.status]?.label || item.status)}
                        </span>
                      </div>
                      <div>
                        {item.gongnuri_type ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white" style={{ backgroundColor: KOGL_TYPES[item.gongnuri_type]?.color || "#999" }}>
                            {KOGL_TYPES[item.gongnuri_type]?.label || item.gongnuri_type}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{formatDateTime(item.created_at)}</div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleReprocess(item)}
                          disabled={isProcessing}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                          재검사
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    {/* 파이프라인 로그 */}
                    {isExpanded && logs.length > 0 && (
                      <div className="px-12 pb-4">
                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
                          <p className="text-xs font-medium text-gray-500 mb-2">파이프라인 로그</p>
                          <div className="space-y-1.5">
                            {logs.map((log, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <LogIcon status={log.status} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-700">{log.step}</span>
                                    <span className="text-xs text-gray-400">{log.timestamp ? formatDateTime(log.timestamp) : ""}</span>
                                  </div>
                                  {log.detail && <p className="text-xs text-gray-500 mt-0.5 break-all">{log.detail}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    {isExpanded && logs.length === 0 && (
                      <div className="px-12 pb-4">
                        <p className="text-xs text-gray-400 italic">파이프라인 로그 없음</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
