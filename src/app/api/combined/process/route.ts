import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { predictRights } from "@/lib/api/rights"
import { classifyKoglType } from "@/lib/api/classifier"
import { mapSSUToWorkFields } from "@/lib/api/ocr"

const SSU_API_URL = process.env.NEXT_PUBLIC_SSU_API_URL || ""
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

// 빌드(page data collection) 시점이 아닌 요청 시점에 생성 (env 필요)
let _admin: ReturnType<typeof createClient<any>> | null = null
function getAdmin() {
  if (!_admin) {
    _admin = createClient<any>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _admin
}

interface FileRef { url: string; name: string }

async function downloadFile(fileUrl: string): Promise<Buffer> {
  const storagePath = fileUrl.replace(/^.*\/storage\/v1\/object\/public\//, "")
  const [bucket, ...rest] = storagePath.split("/")
  const filePath = rest.join("/")
  const { data, error } = await getAdmin().storage.from(bucket).download(filePath)
  if (error || !data) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${storagePath}`)
    if (!res.ok) throw new Error("파일 다운로드 실패")
    return Buffer.from(await res.arrayBuffer())
  }
  return Buffer.from(await data.arrayBuffer())
}

async function ssuExtract(buffer: Buffer, fileName: string, documentType: string): Promise<Record<string, unknown>> {
  const fd = new FormData()
  fd.append("file", new Blob([new Uint8Array(buffer)]), fileName)
  fd.append("document_type", documentType)
  fd.append("consolidate", "true")
  const res = await fetch(`${SSU_API_URL}/api/llm-extract`, { method: "POST", body: fd })
  if (!res.ok) throw new Error(`OCR/메타데이터 추출 실패: ${res.status}`)
  return res.json() as Promise<Record<string, unknown>>
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { rightsCheckId, contractFileUrl, contractFileName, workFiles, documentType } = body as {
      rightsCheckId?: string
      contractFileUrl?: string
      contractFileName?: string
      workFiles?: FileRef[]
      documentType?: string
    }
    if (!rightsCheckId) return NextResponse.json({ error: "rightsCheckId 필요" }, { status: 400 })
    if (!contractFileUrl) return NextResponse.json({ error: "계약서 파일이 필요합니다." }, { status: 400 })

    const docType = documentType || "계약서"
    const fail = async (msg: string, code = 500) => {
      await getAdmin().from("rights_checks").update({ status: "failed" }).eq("id", rightsCheckId)
      return NextResponse.json({ error: msg }, { status: code })
    }

    if (!SSU_API_URL && process.env.NODE_ENV === "production") {
      return fail("OCR 서비스(SSU)가 설정되지 않았습니다.")
    }

    await getAdmin().from("rights_checks").update({ status: "ocr_processing" }).eq("id", rightsCheckId)

    // ── 1) 계약서: SSU 추출 (① 계약서 추출정보 + OCR 텍스트) ──
    let contractMeta: unknown = null
    let ocrText = ""
    try {
      const buf = await downloadFile(contractFileUrl)
      if (SSU_API_URL) {
        const ssu = await ssuExtract(buf, contractFileName || "contract.pdf", docType)
        ocrText = (ssu.ocr_text as string) || ""
        contractMeta = ssu.consolidated_metadata || ssu.metadata || null
      } else {
        ocrText = "콘텐츠 저작재산권 양도계약서\n☑ 복제권, □ 전시권\n유상 사업에 이용할 수 있다."
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : "계약서 처리 실패")
    }

    // ── 2) 저작물 파일들: SSU 추출 → 20항목 매핑 (② 저작물 메타데이터) ──
    const works: Record<string, unknown>[] = []
    for (const wf of workFiles || []) {
      try {
        const wbuf = await downloadFile(wf.url)
        if (SSU_API_URL) {
          const wssu = await ssuExtract(wbuf, wf.name, "기타문서")
          const meta = (wssu.consolidated_metadata || wssu.metadata || {}) as Record<string, unknown>
          works.push({ work_filename: wf.name, ...mapSSUToWorkFields(meta) })
        } else {
          works.push({ work_filename: wf.name })
        }
      } catch {
        works.push({ work_filename: wf.name, _error: "추출 실패" })
      }
    }

    await getAdmin().from("rights_checks").update({
      ocr_text: ocrText.slice(0, 20000),
      contract_metadata: { contract: contractMeta, works },
      status: "predicting",
    }).eq("id", rightsCheckId)

    // ── 3) 공공누리 유형(③④): 기존 HMC 유형분류 API ──
    let hmcType: Record<string, unknown> | null = null
    try {
      const hmc = await classifyKoglType(ocrText, contractFileName)
      hmcType = {
        source: "hmc",
        predicted_type: hmc.predicted_type,
        predicted_display: hmc.predicted_display,
        description: hmc.predicted_description,
        confidence: hmc.confidence,
        probabilities: hmc.probabilities,
        evidence_sentences: (hmc.evidence_sentences || []).map((e) => ({ sentence: e.sentence, best_type: e.best_type, score: e.score })),
      }
    } catch {
      hmcType = null // 유형 실패해도 권리 결과는 저장
    }

    // ── 4) 권리 유형 추정: 신 모델(권리 API) ──
    try {
      const rights = await predictRights(ocrText, contractFileName)
      await getAdmin().from("rights_checks").update({
        summary: rights.summary,
        rights_results: rights.rights_results,
        evidence: rights.evidence,
        model_info: { ...rights.model, mode: "combined", type: hmcType },
        status: "completed",
      }).eq("id", rightsCheckId)
    } catch (e) {
      return fail(e instanceof Error ? e.message : "권리 추정 실패")
    }

    return NextResponse.json({ success: true, rightsCheckId, status: "completed", works: works.length })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "통합 처리 중 오류" }, { status: 500 })
  }
}
