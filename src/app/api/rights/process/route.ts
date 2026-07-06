import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { predictRights } from "@/lib/api/rights"

const SSU_API_URL = process.env.NEXT_PUBLIC_SSU_API_URL || ""
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rightsCheckId, fileUrl, fileName, documentType } = body
    if (!rightsCheckId) {
      return NextResponse.json({ error: "rightsCheckId 필요" }, { status: 400 })
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    await supabase.from("rights_checks").update({ status: "ocr_processing" }).eq("id", rightsCheckId)

    // 1) 파일 다운로드
    if (!fileUrl || fileUrl.startsWith("/demo")) {
      await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
      return NextResponse.json({ error: "유효한 파일 URL이 없습니다." }, { status: 400 })
    }
    const storagePath = fileUrl.replace(/^.*\/storage\/v1\/object\/public\//, "")
    const [bucket, ...rest] = storagePath.split("/")
    const filePath = rest.join("/")
    let fileBuffer: Buffer
    const { data: fileData, error: dlErr } = await supabase.storage.from(bucket).download(filePath)
    if (dlErr || !fileData) {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${storagePath}`)
      if (!res.ok) {
        await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
        return NextResponse.json({ error: "파일 다운로드 실패" }, { status: 500 })
      }
      fileBuffer = Buffer.from(await res.arrayBuffer())
    } else {
      fileBuffer = Buffer.from(await fileData.arrayBuffer())
    }

    // 2) SSU OCR + 메타데이터
    let ocrText = ""
    if (SSU_API_URL) {
      const fd = new FormData()
      fd.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName || "document.pdf")
      fd.append("document_type", documentType || "기타문서")
      fd.append("consolidate", "true")
      const ssuRes = await fetch(`${SSU_API_URL}/api/llm-extract`, { method: "POST", body: fd })
      if (!ssuRes.ok) {
        await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
        return NextResponse.json({ error: `OCR 실패: ${ssuRes.status}` }, { status: 500 })
      }
      const ssu = await ssuRes.json() as Record<string, unknown>
      ocrText = (ssu.ocr_text as string) || ""
      await supabase.from("rights_checks").update({
        ocr_text: ocrText.slice(0, 20000),
        contract_metadata: ssu.consolidated_metadata || ssu.metadata || null,
        status: "predicting",
      }).eq("id", rightsCheckId)
    } else if (process.env.NODE_ENV !== "production") {
      // SSU 미설정 시 Mock 텍스트로 진행 (개발/테스트 전용)
      ocrText = "콘텐츠 저작재산권 양도계약서\n☑ 복제권, □ 전시권\n유상 사업에 이용할 수 있다."
      await supabase.from("rights_checks").update({ ocr_text: ocrText, status: "predicting" }).eq("id", rightsCheckId)
    } else {
      await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
      return NextResponse.json({ error: "OCR 서비스(SSU)가 설정되지 않았습니다." }, { status: 500 })
    }

    // 3) 권리추정
    try {
      const rights = await predictRights(ocrText, fileName)
      await supabase.from("rights_checks").update({
        summary: rights.summary,
        rights_results: rights.rights_results,
        evidence: rights.evidence,
        model_info: rights.model,
        status: "completed",
      }).eq("id", rightsCheckId)
    } catch (error) {
      await supabase.from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
      return NextResponse.json({
        error: error instanceof Error ? error.message : "권리추정 처리 중 오류",
      }, { status: 500 })
    }

    return NextResponse.json({ success: true, rightsCheckId, status: "completed" })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "권리추정 처리 중 오류",
    }, { status: 500 })
  }
}
