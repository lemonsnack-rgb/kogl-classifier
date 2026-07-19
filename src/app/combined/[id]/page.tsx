"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import RightsResultView from "../../rights/RightsResultView"
import type { RightsPredictResponse, RightsCheckStatus } from "@/lib/api/rights-types"
import { ArrowLeft } from "lucide-react"

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
    async function load() {
      if (!isSupabaseConfigured()) { setRow(null); return }
      const supabase = createClient()
      const { data } = await supabase.from("rights_checks").select("*").eq("id", id).single()
      setRow((data as CombinedDetail) || null)
    }
    load()
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

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/combined" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 통합 검사 목록
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6">{row.file_name || "통합 검사 결과"}</h1>

        {row.status !== "completed" ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            상태: {row.status} — 처리가 완료되지 않았습니다.
          </div>
        ) : result ? (
          <RightsResultView
            data={result}
            ocrText={row.ocr_text}
            showType={false}
            showHighlight
            metadata={row.contract_metadata}
            hmcType={row.model_info?.type ?? null}
          />
        ) : (
          <p className="text-sm text-gray-400">결과가 없습니다.</p>
        )}
      </div>
    </AppLayout>
  )
}
