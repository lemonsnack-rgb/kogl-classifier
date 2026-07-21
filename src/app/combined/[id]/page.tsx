"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import PageHeader from "@/components/ui/PageHeader"
import ProcessStepper, { stepIndexFromStatus } from "@/components/ui/ProcessStepper"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import RightsResultView from "../../rights/RightsResultView"
import type { RightsPredictResponse, RightsCheckStatus } from "@/lib/api/rights-types"
import { Layers } from "lucide-react"

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

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    async function load() {
      if (!isSupabaseConfigured()) { setRow(null); return }
      const supabase = createClient()
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <PageHeader
          icon={Layers}
          title={row.file_name || "통합 검사 결과"}
          backHref="/combined"
          backLabel="통합 검사 목록"
        />

        {row.status !== "completed" ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <ProcessStepper steps={COMBINED_STEPS} current={current} failed={failed} />
            <p className={`text-center text-sm mt-4 ${failed ? "text-red-600" : "text-gray-500"}`}>
              {failed
                ? "처리에 실패했습니다. 다시 시도해 주세요."
                : "계약서·저작물을 분석하고 있습니다. 잠시만 기다려 주세요…"}
            </p>
          </div>
        ) : result ? (
          <RightsResultView
            data={result}
            ocrText={row.ocr_text}
            showType={false}
            showHighlight
            metadata={row.contract_metadata}
            hmcType={row.model_info?.type ?? null}
            recordId={row.id}
          />
        ) : (
          <p className="text-sm text-gray-400">결과가 없습니다.</p>
        )}
      </div>
    </AppLayout>
  )
}
