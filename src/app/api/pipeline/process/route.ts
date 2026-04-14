import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const SSU_API_URL = process.env.NEXT_PUBLIC_SSU_API_URL || ""
const HMC_API_URL = process.env.NEXT_PUBLIC_HMC_API_URL || ""
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// 유형1~4 → KOGL-1~4 매핑
const TYPE_MAP: Record<string, string> = {
  "유형1": "KOGL-1",
  "유형2": "KOGL-2",
  "유형3": "KOGL-3",
  "유형4": "KOGL-4",
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contractId, contractFileUrl, contractFilename, documentType } = body

    if (!contractId) {
      return NextResponse.json({ error: "contractId 필요" }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 1단계: 상태 업데이트 → OCR 처리중 ──
    await supabase
      .from("contracts")
      .update({ status: "ocr_processing" })
      .eq("id", contractId)

    // ── 2단계: Supabase Storage에서 파일 다운로드 ──
    let fileBuffer: Buffer
    let fileName = contractFilename || "document.pdf"

    if (contractFileUrl && !contractFileUrl.startsWith("/demo")) {
      // Storage에서 파일 경로 추출
      const storagePath = contractFileUrl.replace(/^.*\/storage\/v1\/object\/public\//, "")
      const bucketAndPath = storagePath.split("/")
      const bucket = bucketAndPath[0]
      const filePath = bucketAndPath.slice(1).join("/")

      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(filePath)

      if (downloadError || !fileData) {
        // Storage 다운로드 실패 시 공개 URL로 시도
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${storagePath}`
        const res = await fetch(publicUrl)
        if (!res.ok) {
          throw new Error(`파일 다운로드 실패: ${downloadError?.message || res.status}`)
        }
        fileBuffer = Buffer.from(await res.arrayBuffer())
      } else {
        fileBuffer = Buffer.from(await fileData.arrayBuffer())
      }
    } else {
      return NextResponse.json({
        error: "유효한 파일 URL이 없습니다.",
      }, { status: 400 })
    }

    // ── 3단계: 숭실대 API 호출 (OCR + 메타데이터) ──
    let ssuResult: Record<string, unknown> | null = null
    let ocrText = ""

    if (SSU_API_URL) {
      const formData = new FormData()
      formData.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName)
      formData.append("document_type", documentType || "기타문서")
      formData.append("consolidate", "true")

      const ssuResponse = await fetch(`${SSU_API_URL}/api/llm-extract`, {
        method: "POST",
        body: formData,
      })

      if (ssuResponse.ok) {
        ssuResult = await ssuResponse.json() as Record<string, unknown>
        ocrText = (ssuResult.ocr_text as string) || ""

        // DB 업데이트: 메타데이터 저장
        await supabase
          .from("contracts")
          .update({
            ocr_text: ocrText.slice(0, 10000),
            contract_metadata: ssuResult.consolidated_metadata || ssuResult.metadata || null,
            status: "classifying",
          })
          .eq("id", contractId)
      } else {
        const errorText = await ssuResponse.text()
        console.error("SSU API 오류:", errorText)
        await supabase
          .from("contracts")
          .update({ status: "failed" })
          .eq("id", contractId)
        return NextResponse.json({
          error: `메타데이터 추출 실패: ${ssuResponse.status}`,
        }, { status: 500 })
      }
    }

    // ── 4단계: HMC API 호출 (유형 분류) ──
    let hmcResult: Record<string, unknown> | null = null

    if (HMC_API_URL && ocrText) {
      const hmcResponse = await fetch(`${HMC_API_URL}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: ocrText,
          file_name: fileName,
          auto_detect_form: true,
        }),
      })

      if (hmcResponse.ok) {
        hmcResult = await hmcResponse.json() as Record<string, unknown>
        const predictedType = (hmcResult.predicted_type as string) || ""
        const koglType = TYPE_MAP[predictedType] || null
        const confidence = (hmcResult.confidence as number) || null
        const evidenceSentences = (hmcResult.evidence_sentences as Array<{ sentence: string; best_type: string; score: number }>) || []

        // DB 업데이트: 분류 결과 저장
        await supabase
          .from("contracts")
          .update({
            gongnuri_type: koglType,
            gongnuri_confidence: confidence,
            gongnuri_evidence: evidenceSentences.map(e => e.sentence).join("\n"),
            status: "completed",
          })
          .eq("id", contractId)

        // 근거 문장 → contract_clauses 테이블에 저장
        if (evidenceSentences.length > 0) {
          const clauses = evidenceSentences.map(ev => ({
            contract_id: contractId,
            clause_type: "SCOPE",
            clause_text: ev.sentence,
            match_score: ev.score,
          }))

          await supabase.from("contract_clauses").insert(clauses)
        }
      } else {
        console.error("HMC API 오류:", await hmcResponse.text())
        // 분류 실패해도 메타데이터는 저장됨 → review_required 상태
        await supabase
          .from("contracts")
          .update({ status: "review_required" })
          .eq("id", contractId)
      }
    } else if (!HMC_API_URL) {
      // HMC URL 없으면 review_required
      await supabase
        .from("contracts")
        .update({ status: "review_required" })
        .eq("id", contractId)
    }

    return NextResponse.json({
      success: true,
      contractId,
      ssuSuccess: !!ssuResult,
      hmcSuccess: !!hmcResult,
      koglType: hmcResult ? TYPE_MAP[(hmcResult.predicted_type as string) || ""] : null,
      processingTime: ssuResult ? (ssuResult.processing_time as number) : 0,
    })
  } catch (error) {
    console.error("Pipeline error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "파이프라인 처리 중 오류",
    }, { status: 500 })
  }
}
