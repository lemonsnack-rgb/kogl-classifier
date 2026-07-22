"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import ProcessStepper, { stepIndexFromStatus } from "@/components/ui/ProcessStepper"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import RightsResultView, { MetadataTable } from "../../rights/RightsResultView"
import DetailConsole from "@/components/detail/DetailConsole"
import type { RightsPredictResponse, RightsCheckStatus } from "@/lib/api/rights-types"

const COMBINED_STEPS = ["업로드", "OCR·메타데이터", "유형·권리 분석"]

interface HmcTypeInfo {
  predicted_type: string
  predicted_display?: string
  description?: string
  confidence?: number
  evidence_sentences?: { sentence: string; best_type?: string; score?: number }[]
}

interface CombinedDetail {
  id: string
  user_id: string | null
  file_name: string | null
  status: RightsCheckStatus
  ocr_text: string | null
  contract_metadata: Record<string, unknown> | null
  summary: RightsPredictResponse["summary"] | null
  rights_results: RightsPredictResponse["rights_results"] | null
  evidence: RightsPredictResponse["evidence"] | null
  model_info: (RightsPredictResponse["model"] & { type?: HmcTypeInfo | null; mode?: string }) | null
  created_at: string
}

export default function CombinedDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [row, setRow] = useState<CombinedDetail | null | undefined>(undefined)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    async function load() {
      if (!isSupabaseConfigured()) { setRow(null); return }
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      const { data } = await supabase.from("rights_checks").select("*").eq("id", id).single()
      const detail = (data as CombinedDetail) || null
      setRow(detail)
      if (detail && (detail.status === "completed" || detail.status === "failed") && timer) {
        clearInterval(timer)
      }
    }
    load()
    timer = setInterval(load, 5000)
    return () => { if (timer) clearInterval(timer) }
  }, [id])

  if (row === undefined) {
    return <AppLayout><div className="p-8 text-sm text-gray-400">불러오는 중...</div></AppLayout>
  }
  if (!row) {
    return <AppLayout><div className="p-8 text-sm text-gray-400">데이터가 없습니다.</div></AppLayout>
  }

  const result: RightsPredictResponse | null =
    row.rights_results ? {
      ok: true, document_id: row.id, file_name: row.file_name, type: null,
      model: row.model_info || { model_kind: null, base_model: null, checkpoint: null, evidence_threshold: null, top_k: null },
      summary: row.summary || { safe: 0, review: 0, none: 0, evidence_count: 0 },
      rights_results: row.rights_results,
      evidence: row.evidence || [],
    } : null

  const { current, failed } = stepIndexFromStatus(row.status)

  // 통합 메타데이터: { contract, works }
  const meta = (row.contract_metadata as { contract?: Record<string, unknown> | null; works?: Record<string, unknown>[] } | null) || null
  const contract = meta?.contract || null
  const works = meta?.works || []

  async function saveWork(index: number, patch: Record<string, unknown>, nextWorks: Record<string, unknown>[], reason?: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const old = (works[index] || {}) as Record<string, unknown>
    const oldType = (old.resolved_type ?? null) as unknown
    const oldAi = (old.ai_type_applied ?? null) as unknown
    const newType = (patch.resolved_type ?? null) as unknown
    const newAi = (patch.ai_type_applied ?? null) as unknown

    const augmented = [...nextWorks]
    const cur = { ...(augmented[index] || {}) } as Record<string, unknown>
    // 최초(자동) 판정 보존: _auto가 없으면 수정 직전 값 스냅샷(불변)
    if (cur.resolved_type_auto == null && cur.ai_type_auto == null) {
      cur.resolved_type_auto = oldType
      cur.ai_type_auto = oldAi
    }
    // 판정 변경 이력 로그(라벨링용)
    const at = new Date().toISOString()
    const by = user?.id ?? null
    const prevLog = Array.isArray(cur.edit_log) ? (cur.edit_log as unknown[]) : []
    const entries: Record<string, unknown>[] = []
    if (oldType !== newType) entries.push({ field: "resolved_type", from: oldType, to: newType, by, at, reason: reason ?? null })
    if (oldAi !== newAi) entries.push({ field: "ai_type_applied", from: oldAi, to: newAi, by, at, reason: reason ?? null })
    cur.edit_log = [...prevLog, ...entries]
    augmented[index] = cur

    const { error } = await supabase
      .from("rights_checks")
      .update({ contract_metadata: { contract: contract ?? null, works: augmented } })
      .eq("id", id)
    if (error) throw new Error(error.message)
  }

  // 계약서(레코드) 공공누리 유형 판정: 저장값 우선, 없으면 유형분류(HMC) 결과로 초기 제시
  const hmcPred = row.model_info?.type?.predicted_type
  const seedType = (() => {
    const saved = contract?.resolved_type
    if (typeof saved === "string" && saved) return saved
    if (typeof hmcPred === "string") {
      const m = hmcPred.match(/([0-4])/)
      if (m) return `KOGL-${m[1]}`
    }
    return null
  })()
  const contractJudgment = contract ? {
    resolved_type: seedType,
    ai_type_applied: (contract.ai_type_applied ?? null) as boolean | null,
    type_reason: (contract.type_reason ?? null) as string | null,
    resolved_type_auto: (contract.resolved_type_auto ?? null) as string | null,
    ai_type_auto: (contract.ai_type_auto ?? null) as boolean | null,
  } : null

  async function saveContractJudgment(resolvedType: string | null, ai: boolean | null, reason?: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const base = (contract ?? {}) as Record<string, unknown>
    const oldType = (base.resolved_type ?? seedType ?? null) as unknown
    const oldAi = (base.ai_type_applied ?? null) as unknown
    const next: Record<string, unknown> = { ...base, resolved_type: resolvedType, ai_type_applied: ai }
    if (next.resolved_type_auto == null && next.ai_type_auto == null) {
      next.resolved_type_auto = oldType
      next.ai_type_auto = oldAi
    }
    const at = new Date().toISOString()
    const by = user?.id ?? null
    const prevLog = Array.isArray(next.edit_log) ? (next.edit_log as unknown[]) : []
    const entries: Record<string, unknown>[] = []
    if (oldType !== resolvedType) entries.push({ field: "resolved_type", from: oldType, to: resolvedType, by, at, reason: reason ?? null })
    if (oldAi !== ai) entries.push({ field: "ai_type_applied", from: oldAi, to: ai, by, at, reason: reason ?? null })
    next.edit_log = [...prevLog, ...entries]
    const { error } = await supabase
      .from("rights_checks")
      .update({ contract_metadata: { contract: next, works } })
      .eq("id", id)
    if (error) throw new Error(error.message)
  }

  const isOwner = !!currentUserId && row.user_id === currentUserId

  if (row.status !== "completed") {
    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <ProcessStepper steps={COMBINED_STEPS} current={current} failed={failed} />
            <p className={`text-center text-sm mt-4 ${failed ? "text-red-600" : "text-gray-500"}`}>
              {failed
                ? "처리에 실패했습니다. 다시 시도해 주세요."
                : "계약서·저작물을 분석하고 있습니다. 잠시만 기다려 주세요…"}
            </p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <DetailConsole
        title={row.file_name || "통합 검사 결과"}
        backHref="/combined"
        backLabel="통합 검사 목록"
        leftTop={
          result ? (
            <RightsResultView
              data={result}
              ocrText={row.ocr_text}
              showType={false}
              showHighlight
              metadata={row.contract_metadata}
              hmcType={row.model_info?.type ?? null}
              recordId={row.id}
              showMetadata={false}
            />
          ) : (
            <p className="text-sm text-gray-400">권리 판정 결과가 없습니다.</p>
          )
        }
        contractMetaNode={
          contract && Object.keys(contract).length > 0
            ? <MetadataTable data={contract} showEmpty />
            : <p className="text-sm text-gray-400">추출된 계약서 메타데이터가 없습니다.</p>
        }
        works={works}
        onSaveWork={isOwner ? saveWork : undefined}
        editNote={isOwner ? undefined : "본인 검사만 수정 가능합니다"}
        contractJudgment={contractJudgment}
        onSaveContractJudgment={isOwner ? saveContractJudgment : undefined}
      />
    </AppLayout>
  )
}
