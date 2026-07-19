"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import ProcessStepper, { stepIndexFromStatus } from "@/components/ui/ProcessStepper"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import RightsResultView from "../RightsResultView"
import type { RightsPredictResponse, RightsCheckStatus } from "@/lib/api/rights-types"
import { ScrollText } from "lucide-react"

const RIGHTS_STEPS = ["업로드", "OCR·메타데이터", "권리 판정"]

interface RightsCheckDetail {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  ocr_text: string | null
  contract_metadata: Record<string, unknown> | null
  summary: RightsPredictResponse["summary"] | null
  rights_results: RightsPredictResponse["rights_results"] | null
  evidence: RightsPredictResponse["evidence"] | null
  // 유형추정 결과(type)는 model_info 안에 함께 저장됨
  model_info: (RightsPredictResponse["model"] & { type?: RightsPredictResponse["type"] }) | null
  created_at: string
}

export default function RightsDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [row, setRow] = useState<RightsCheckDetail | null | undefined>(undefined)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    async function load() {
      if (!isSupabaseConfigured()) { setRow(null); return }
      const supabase = createClient()
      const { data } = await supabase.from("rights_checks").select("*").eq("id", id).single()
      const detail = (data as RightsCheckDetail) || null
      setRow(detail)
      // 처리중이면 폴링 유지, 완료/실패면 중단 (실시간 진행 표시)
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
      ok: true, document_id: row.id, file_name: row.file_name,
      type: row.model_info?.type ?? null,
      model: row.model_info || {
        model_kind: null, base_model: null, checkpoint: null, evidence_threshold: null, top_k: null },
      summary: row.summary || { safe: 0, review: 0, none: 0, evidence_count: 0 },
      rights_results: row.rights_results,
      evidence: row.evidence || [],
    } : null

  const { current, failed } = stepIndexFromStatus(row.status)

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeader
          icon={ScrollText}
          title={row.file_name || "권리추정 결과"}
          backHref="/rights"
          backLabel="권리추정 목록"
        />

        {row.status !== "completed" ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <ProcessStepper steps={RIGHTS_STEPS} current={current} failed={failed} />
            <p className={`text-center text-sm mt-4 ${failed ? "text-red-600" : "text-gray-500"}`}>
              {failed
                ? "처리에 실패했습니다. 다시 시도해 주세요."
                : "계약서를 분석하고 있습니다. 잠시만 기다려 주세요…"}
            </p>
          </div>
        ) : result ? (
          <RightsResultView data={result} showType={false} showHighlight={false} />
        ) : (
          <p className="text-sm text-gray-400">권리 결과가 없습니다.</p>
        )}
      </div>
    </AppLayout>
  )
}
