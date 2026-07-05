"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import RightsResultView from "../RightsResultView"
import type { RightsPredictResponse, RightsCheckStatus } from "@/lib/api/rights-types"
import { ArrowLeft } from "lucide-react"

interface RightsCheckDetail {
  id: string
  file_name: string | null
  status: RightsCheckStatus
  contract_metadata: Record<string, unknown> | null
  summary: RightsPredictResponse["summary"] | null
  rights_results: RightsPredictResponse["rights_results"] | null
  evidence: RightsPredictResponse["evidence"] | null
  model: RightsPredictResponse["model"] | null
  model_info: RightsPredictResponse["model"] | null
  created_at: string
}

export default function RightsDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [row, setRow] = useState<RightsCheckDetail | null | undefined>(undefined)

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) { setRow(null); return }
      const supabase = createClient()
      const { data } = await supabase.from("rights_checks").select("*").eq("id", id).single()
      setRow((data as RightsCheckDetail) || null)
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
      ok: true, document_id: row.id, file_name: row.file_name,
      model: row.model_info || row.model || {
        model_kind: null, base_model: null, checkpoint: null, evidence_threshold: null, top_k: null },
      summary: row.summary || { safe: 0, review: 0, none: 0, evidence_count: 0 },
      rights_results: row.rights_results,
      evidence: row.evidence || [],
    } : null

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/rights" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> 권리추정 목록
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mb-6">{row.file_name || "권리추정 결과"}</h1>

        {row.status !== "completed" ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            상태: {row.status} — 처리가 완료되지 않았습니다.
          </div>
        ) : result ? (
          <RightsResultView data={result} />
        ) : (
          <p className="text-sm text-gray-400">권리 결과가 없습니다.</p>
        )}
      </div>
    </AppLayout>
  )
}
