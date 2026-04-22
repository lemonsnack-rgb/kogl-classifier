"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { getContractById } from "@/lib/mock/data"
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client"
import type { Contract } from "@/types"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { KoglType, ContractStatus, ClauseType, Work } from "@/types"
import {
  Download,
  ArrowLeft,
  FileText,
  Pencil,
  X,
  Save,
  Check,
  Eye,
} from "lucide-react"

const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
  OWNERSHIP: "소유권/귀속",
  LICENSE: "이용허락",
  DERIVATIVE: "2차적 저작물",
  SCOPE: "이용범위",
  TERM: "기간",
  ATTRIBUTION: "출처표시",
}

const WORK_TYPE_LABELS: Record<string, string> = {
  image: "이미지",
  text: "텍스트",
  audio: "오디오",
  video: "영상",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** KOGL 유형 문자열에서 이미지 번호 추출 */
function getKoglImageSrc(type: KoglType): string {
  const num = type.replace("KOGL-", "")
  return `/images/kogl/type${num}.jpg`
}

/** CSV 다운로드 유틸 */
function downloadCsv(works: Work[], contractFilename: string | null) {
  const headers = [
    "저작물명",
    "유형",
    "디지털화형태",
    "설명",
    "주제어",
    "언어",
    "제작일",
    "계약서",
    "저작권자",
    "공동저작자",
    "저작인접권자",
    "공개유형",
    "저작물성",
    "비보호저작물",
    "업무상저작물",
    "상업적이용허락",
    "저작재산권",
    "공동저작자동의",
    "유효기간",
    "초상권",
  ]

  const rows = works.map((w) => [
    w.work_name ?? "",
    w.work_type ? (WORK_TYPE_LABELS[w.work_type] ?? w.work_type) : "",
    w.digital_format ?? "",
    w.description ?? "",
    w.keywords?.join(", ") ?? "",
    w.language ?? "",
    w.created_date ?? "",
    contractFilename ?? "",
    w.creator ?? "",
    "", // 공동저작자 - 현재 데이터 없음
    "", // 저작인접권자 - 현재 데이터 없음
    "", // 공개유형
    "", // 저작물성
    "", // 비보호저작물
    "", // 업무상저작물
    w.usage_scope ?? "", // 상업적이용허락
    w.copyright_period ?? "", // 저작재산권
    w.contract_metadata?.consent_status ?? "", // 공동저작자동의
    w.copyright_period ?? "", // 유효기간
    "", // 초상권
  ])

  // BOM + CSV
  const BOM = "\uFEFF"
  const csvContent =
    BOM +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `메타데이터_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function handleFileDownload() {
  alert("다운로드 기능은 Supabase Storage 연동 후 사용 가능합니다")
}

export default function WorkDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [contract, setContract] = useState<Contract | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [selectedWorkIdx, setSelectedWorkIdx] = useState<number | null>(null)
  const [showMetaDetail, setShowMetaDetail] = useState(false)
  const [editingContractMeta, setEditingContractMeta] = useState(false)
  const [contractMetaForm, setContractMetaForm] = useState<Record<string, string>>({})

  useEffect(() => {
    async function loadContract() {
      // Supabase DB에서 검색
      if (isSupabaseConfigured()) {
        try {
          const supabase = createClient()

          // 계약서 정보
          const { data: contractData, error: contractError } = await supabase
            .from("contracts")
            .select("*")
            .eq("id", id)
            .single()

          if (contractError || !contractData) {
            setContract(null)
            setLoading(false)
            return
          }

          // 저작물 목록
          const { data: worksData } = await supabase
            .from("works")
            .select("*")
            .eq("contract_id", id)
            .order("created_at", { ascending: true })

          // 근거 조항
          const { data: clausesData } = await supabase
            .from("contract_clauses")
            .select("*")
            .eq("contract_id", id)
            .order("created_at", { ascending: true })

          // 등록자 프로필 조회
          const { data: profileData } = await supabase
            .from("profiles")
            .select("name, organization")
            .eq("id", contractData.user_id)
            .single()

          setContract({
            ...contractData,
            works: worksData || [],
            clauses: clausesData || [],
            works_count: worksData?.length || 0,
            profile: profileData || undefined,
          })
        } catch {
          setContract(null)
        }
      } else {
        setContract(null)
      }
      setLoading(false)
    }
    loadContract()
  }, [id])
  const [editingType, setEditingType] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)

  // 공공누리 유형 인라인 수정 상태
  const [editTypeValue, setEditTypeValue] = useState<KoglType | "">(
    contract?.gongnuri_type ?? ""
  )
  const [editTypeReason, setEditTypeReason] = useState("")

  // 메타데이터 인라인 수정 상태
  const [metaForm, setMetaForm] = useState<Record<string, string>>({})

  if (loading || contract === undefined) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-48px)]">
          <p className="text-sm text-gray-400">데이터를 불러오는 중...</p>
        </div>
      </AppLayout>
    )
  }

  if (!contract) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-48px)]">
          <div className="text-center">
            <p className="text-gray-400 text-lg">데이터가 없습니다.</p>
            <Link
              href="/works"
              className="mt-4 inline-block text-primary-600 text-sm hover:underline"
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </AppLayout>
    )
  }

  const works = contract.works ?? []
  const clauses = contract.clauses ?? []
  const selectedWork =
    selectedWorkIdx !== null ? works[selectedWorkIdx] : null

  function startEditType() {
    setEditTypeValue(contract!.gongnuri_type ?? "")
    setEditTypeReason("")
    setEditingType(true)
  }

  function cancelEditType() {
    setEditingType(false)
    setEditTypeValue(contract!.gongnuri_type ?? "")
    setEditTypeReason("")
  }

  function saveEditType() {
    alert("유형이 저장되었습니다")
    setEditingType(false)
  }

  function startEditMeta() {
    if (!selectedWork) return
    setMetaForm({
      work_name: selectedWork.work_name ?? "",
      work_type: selectedWork.work_type ?? "",
      digital_format: selectedWork.digital_format ?? "",
      description: selectedWork.description ?? "",
      keywords: selectedWork.keywords?.join(", ") ?? "",
      language: selectedWork.language ?? "",
      created_date: selectedWork.created_date ?? "",
      creator: selectedWork.creator ?? "",
      copyright_period: selectedWork.copyright_period ?? "",
      usage_scope: selectedWork.usage_scope ?? "",
    })
    setEditingMeta(true)
  }

  function cancelEditMeta() {
    setEditingMeta(false)
    setMetaForm({})
  }

  function saveEditMeta() {
    alert("저장되었습니다")
    setEditingMeta(false)
    setMetaForm({})
  }

  function handleSelectWork(idx: number) {
    setSelectedWorkIdx(idx)
    setEditingMeta(false)
    setShowMetaDetail(false)
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-24px)]">
        {/* ====== 상단: 검사명 (최상위 위계) ====== */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <Link
            href="/works"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Link>
          <h1 className="text-xl font-bold text-gray-900">
            {contract.inspection_title ??
              contract.contract_filename ??
              "검사 결과"}
          </h1>
        </div>

        {/* ====== 하단: 좌우 2단 ====== */}
        <div className="flex flex-1 min-h-0">
        {/* ====== 좌측 패널 ====== */}
        <div className="w-1/2 flex-shrink-0 overflow-y-auto border-r border-gray-200 bg-white px-6 py-5">

          {/* ── 계약서 정보 섹션 ── */}
          <SectionDivider title="계약서 기본정보" />
          <div className="space-y-2.5 mb-6">
            <LeftField
              label="파일명"
              value={
                contract.contract_filename ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="truncate max-w-[220px]">
                      {contract.contract_filename}
                    </span>
                    <button
                      onClick={handleFileDownload}
                      className="text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
                      title="다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ) : (
                  <EmptyValue />
                )
              }
            />
            <LeftField
              label="등록일"
              value={formatDate(contract.created_at)}
            />
            <LeftField label="등록자" value={
              contract.profile
                ? `${contract.profile.organization || ""} ${contract.profile.name || ""}`.trim() || contract.user_id
                : contract.user_id
            } />
            <LeftField
              label="상태"
              value={<StatusBadge status={contract.status} />}
            />
            <LeftField
              label="자체제작 여부"
              value={contract.is_institution_made ? "자체 제작" : "외부 위탁"}
            />
          </div>

          {/* 섹션 구분선 */}
          <div className="border-t border-gray-200 my-5" />

          {/* ── 공공누리 유형 분류 결과 섹션 ── */}
          <div className="flex items-center justify-between mb-3">
            <SectionDivider title="공공누리 자동분류 정보" />
            {!editingType && contract.gongnuri_type && (
              <button
                onClick={startEditType}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 border border-primary-200 rounded hover:bg-primary-50 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                수정
              </button>
            )}
          </div>

          {editingType ? (
            /* 인라인 수정 모드 */
            <div className="mb-6 space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  유형 선택
                </label>
                <select
                  value={editTypeValue}
                  onChange={(e) =>
                    setEditTypeValue(e.target.value as KoglType | "")
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">선택하세요</option>
                  {(
                    Object.keys(KOGL_TYPES) as KoglType[]
                  ).map((k) => (
                    <option key={k} value={k}>
                      {KOGL_TYPES[k].label} - {KOGL_TYPES[k].description}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  수정 사유
                </label>
                <textarea
                  value={editTypeReason}
                  onChange={(e) => setEditTypeReason(e.target.value)}
                  rows={3}
                  placeholder="수정 사유를 입력하세요"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveEditType}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                >
                  <Save className="w-3 h-3" />
                  저장
                </button>
                <button
                  onClick={cancelEditType}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3 h-3" />
                  취소
                </button>
              </div>
            </div>
          ) : contract.gongnuri_type ? (
            <div className="mb-6">
              {/* KOGL 이미지 + 유형 */}
              <div className="flex items-center gap-4 mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getKoglImageSrc(contract.gongnuri_type)}
                  alt={`공공누리 ${KOGL_TYPES[contract.gongnuri_type].label}`}
                  className="h-[72px] w-auto object-contain rounded flex-shrink-0"
                />
                <div className="flex items-center gap-3">
                  <KoglBadge type={contract.gongnuri_type} />
                  <span className="text-base text-gray-600">
                    {KOGL_TYPES[contract.gongnuri_type].description}
                  </span>
                </div>
              </div>

              {/* 분류 정확도 */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-500">분류 정확도</span>
                  <span className="text-sm font-semibold text-gray-700 tabular-nums">
                    {((contract.gongnuri_confidence ?? 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(contract.gongnuri_confidence ?? 0) * 100}%`,
                      backgroundColor:
                        KOGL_TYPES[contract.gongnuri_type].color,
                    }}
                  />
                </div>
              </div>

              {/* 판단 근거 (필수) */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-500 font-medium">자동분류 근거 내용</span>
                </div>
              {clauses.length > 0 ? (
                  <div className="space-y-2">
                    {clauses.map((clause) => (
                      <div
                        key={clause.id}
                        className="border border-gray-100 rounded-lg p-3"
                      >
                        <div className="mb-1.5">
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-primary-50 text-primary-700">
                            {CLAUSE_TYPE_LABELS[clause.clause_type] ??
                              clause.clause_type}
                          </span>
                        </div>
                        <blockquote className="border-l-3 border-accent-500 bg-accent-50 pl-3 py-2 text-sm italic text-gray-700 leading-relaxed">
                          &ldquo;{clause.clause_text}&rdquo;
                        </blockquote>
                      </div>
                    ))}
                  </div>
              ) : (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-amber-700 font-medium">
                    자동분류 근거 내용이 아직 추출되지 않았습니다. 근거 문구는 필수 항목입니다.
                  </p>
                </div>
              )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-300 italic mb-6">
              분류 결과 없음
            </p>
          )}

          {/* 섹션 구분선 */}
          <div className="border-t border-gray-200 my-5" />

          {/* ── 계약서 추출 메타데이터 (요약) ── */}
          {contract.contract_metadata && (
            <>
              <SectionDivider title="계약서 추출 메타데이터" />
              <div className="space-y-2 mb-3">
                <MetaSummary data={contract.contract_metadata} />
              </div>
              <button
                onClick={() => {
                  setShowMetaDetail(true)
                  setSelectedWorkIdx(null)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors mb-6"
              >
                <Eye className="w-3.5 h-3.5" />
                상세 보기
              </button>
              <div className="border-t border-gray-200 my-5" />
            </>
          )}

          {/* ── 저작물 목록 섹션 ── */}
          <SectionDivider title={`저작물 목록 (${works.length}건)`} />
          {works.length === 0 ? (
            <p className="text-sm text-gray-300 italic">
              등록된 저작물이 없습니다.
            </p>
          ) : (
            <div className="space-y-1 mb-6">
              {works.map((work, idx) => {
                const isSelected = selectedWorkIdx === idx
                return (
                  <button
                    key={work.id}
                    onClick={() => handleSelectWork(idx)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors relative ${
                      isSelected
                        ? "bg-primary-50 border border-primary-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-primary-600 rounded-r" />
                    )}
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold flex-shrink-0 ${
                        isSelected
                          ? "bg-primary-600 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium truncate">
                        {work.work_name ?? work.work_filename}
                      </p>
                    </div>
                    {work.work_type && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">
                        {WORK_TYPE_LABELS[work.work_type] ?? work.work_type}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* 엑셀 다운로드 */}
          <button
            onClick={() =>
              downloadCsv(works, contract.contract_filename)
            }
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            엑셀 다운로드
          </button>
        </div>

        {/* ====== 우측 패널 ====== */}
        <div className="w-1/2 overflow-y-auto bg-gray-50 px-8 py-5">
          {showMetaDetail && contract.contract_metadata ? (
            /* ── 계약서 메타데이터 상세 모드 ── */
            <div>
              <div className="flex items-center justify-between mb-5">
                <SectionDivider title="계약서 추출 메타데이터 상세" />
                <div className="flex gap-2">
                  {!editingContractMeta ? (
                    <>
                      <button
                        onClick={() => {
                          const flat = flattenJson(contract.contract_metadata!)
                          setContractMetaForm(flat)
                          setEditingContractMeta(true)
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        수정
                      </button>
                      <button
                        onClick={() => {
                          setShowMetaDetail(false)
                          setEditingContractMeta(false)
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        닫기
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          alert("메타데이터가 저장되었습니다")
                          setEditingContractMeta(false)
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                      >
                        <Save className="w-3 h-3" />
                        저장
                      </button>
                      <button
                        onClick={() => {
                          setEditingContractMeta(false)
                          setContractMetaForm({})
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <X className="w-3 h-3" />
                        취소
                      </button>
                    </>
                  )}
                </div>
              </div>
              <MetadataTable
                data={contract.contract_metadata}
                editing={editingContractMeta}
                form={contractMetaForm}
                onChange={(key, value) => setContractMetaForm(prev => ({ ...prev, [key]: value }))}
              />
            </div>
          ) : selectedWork === null ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 text-gray-300" />
                </div>
                <p className="text-sm text-gray-400">
                  좌측에서 저작물을 선택하세요
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* 영역 제목: 저작물 메타데이터 - 좌측 섹션과 동일 위계 */}
              <SectionDivider title="저작물 메타데이터" />

              {/* 선택된 저작물 + 수정/취소 버튼 */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary-600 text-white text-xs font-bold">
                    {(selectedWorkIdx ?? 0) + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-800">
                    {selectedWork.work_name ?? selectedWork.work_filename}
                  </h3>
                </div>
                {!editingMeta ? (
                  <div className="flex gap-2">
                    {selectedWork.work_file_url && (
                      <button
                        onClick={() => {
                          const url = selectedWork.work_file_url
                          if (!url || url.startsWith("/mock")) {
                            alert("Mock 데이터는 미리보기를 지원하지 않습니다.")
                            return
                          }
                          window.open(url, "_blank")
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        미리보기
                      </button>
                    )}
                    <button
                      onClick={startEditMeta}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      수정
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={saveEditMeta}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      저장
                    </button>
                    <button
                      onClick={cancelEditMeta}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      취소
                    </button>
                  </div>
                )}
              </div>

              <WorkMetadataTable
                work={selectedWork}
                contractFilename={contract.contract_filename}
                editing={editingMeta}
                form={metaForm}
                onChange={(key, value) => setMetaForm((p) => ({ ...p, [key]: value }))}
              />
            </div>
          )}
        </div>
        </div>
      </div>
    </AppLayout>
  )
}

/* ====================================================
   Sub Components
==================================================== */

/** 좌측 패널 섹션 구분선 + 섹션명 */
function SectionDivider({ title }: { title: string }) {
  return (
    <div className="mb-4">
      <span className="text-base font-bold text-gray-600 tracking-wide">
        {title}
      </span>
    </div>
  )
}

/** 좌측 패널 필드 (label + value 세로 배치) */
function LeftField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-sm text-gray-500 w-24 flex-shrink-0">{label}</span>
      <div className="text-sm text-gray-900 font-medium flex-1 min-w-0">
        {value}
      </div>
    </div>
  )
}

/** 미식별 빈 값 표시 */
function EmptyValue() {
  return <span className="text-sm text-gray-400 italic">미식별</span>
}

/** KOGL 뱃지 (소형) */
function KoglBadge({ type }: { type: KoglType }) {
  const meta = KOGL_TYPES[type]
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-md text-sm font-bold text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}

/** 상태 뱃지 */
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

/** 우측 패널 메타데이터 섹션 래퍼 */
function MetaSection({
  title,
  color,
  children,
}: {
  title: string
  color: "blue" | "green" | "amber"
  children: React.ReactNode
}) {
  const colorMap = {
    blue: {
      border: "border-blue-100",
      bg: "bg-blue-50/50",
      title: "text-blue-800",
    },
    green: {
      border: "border-green-100",
      bg: "bg-green-50/50",
      title: "text-green-800",
    },
    amber: {
      border: "border-amber-100",
      bg: "bg-amber-50/50",
      title: "text-amber-800",
    },
  }
  const c = colorMap[color]
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-5 mb-4`}>
      <h3 className={`text-base font-bold ${c.title} mb-4`}>{title}</h3>
      {children}
    </div>
  )
}

/** 우측 패널 메타데이터 필드 (읽기/수정 겸용) */
function MetaField({
  label,
  value,
  editing = false,
  editValue,
  editType = "input",
  selectOptions,
  placeholder,
  onChange,
}: {
  label: string
  value: React.ReactNode
  editing?: boolean
  editValue?: string
  editType?: "input" | "select"
  selectOptions?: { value: string; label: string }[]
  placeholder?: string
  onChange?: (v: string) => void
}) {
  return (
    <div>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      {editing && onChange ? (
        editType === "select" && selectOptions ? (
          <select
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {selectOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={editValue ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        )
      ) : (
        <div className="text-sm text-gray-900 font-medium">
          {value === null ||
          value === undefined ||
          value === "" ||
          value === "-" ? (
            <EmptyValue />
          ) : (
            value
          )}
        </div>
      )}
    </div>
  )
}

/** 계약서 메타데이터 요약 (핵심 3~4개만 표시) */
function MetaSummary({ data }: { data: Record<string, unknown> }) {
  // 문서 유형별 핵심 필드 결정
  const summaryFields: { key: string; label: string }[] = []

  if (data.consent_type) {
    summaryFields.push({ key: "consent_type", label: "유형" })
    if (data.data_subject) summaryFields.push({ key: "data_subject", label: "정보주체" })
    if (data.data_controller) summaryFields.push({ key: "data_controller", label: "처리기관" })
    if (data.consent_date) summaryFields.push({ key: "consent_date", label: "동의 날짜" })
  } else if (data.contract_type) {
    summaryFields.push({ key: "contract_type", label: "유형" })
    if (data.work_title) summaryFields.push({ key: "work_title", label: "저작물명" })
    if (data.rights_holder) summaryFields.push({ key: "rights_holder", label: "권리자" })
    if (data.signature_date) summaryFields.push({ key: "signature_date", label: "서명일" })
  } else {
    // 기본: 처음 4개 키
    const keys = Object.keys(data).slice(0, 4)
    keys.forEach((k) => summaryFields.push({ key: k, label: getLabel(k) }))
  }

  return (
    <div className="space-y-2">
      {summaryFields.map(({ key, label }) => {
        const val = data[key]
        const display = val === null || val === undefined
          ? null
          : typeof val === "object"
          ? JSON.stringify(val)
          : String(val)
        return (
          <div key={key} className="flex items-baseline gap-3">
            <span className="text-sm text-gray-500 w-20 flex-shrink-0">{label}</span>
            <span className="text-sm text-gray-900 font-medium">{display ?? <EmptyValue />}</span>
          </div>
        )
      })}
    </div>
  )
}

/** 필드명 한글 매핑 */
const FIELD_LABELS: Record<string, string> = {
  consent_type: "동의서 유형",
  contract_type: "계약서 유형",
  data_controller: "처리기관",
  data_subject: "정보주체",
  collection_purpose: "수집 목적",
  collected_data_types: "수집 항목",
  retention_period: "보유 기간",
  third_party_sharing: "제3자 제공",
  recipient: "제공받는 자",
  purpose: "이용 목적",
  data_types: "제공 항목",
  consent_status: "동의 여부",
  consent_date: "동의 날짜",
  signature: "서명",
  signature_date: "서명 날짜",
  contact_info: "연락처",
  phone: "전화번호",
  address: "주소",
  email: "이메일",
  parties: "당사자",
  name: "이름",
  role: "역할",
  registration_no: "등록번호",
  rights_holder: "권리자",
  user: "이용기관",
  work_title: "저작물명",
  work_category: "저작물 분류",
  granted_rights: "양도 권리",
  reproduction_right: "복제권",
  performance_right: "공연권",
  broadcasting_right: "방송권",
  exhibition_right: "전시권",
  distribution_right: "배포권",
  rental_right: "대여권",
  derivative_work_right: "2차적저작물작성권",
  contract_purpose: "계약 목적",
  contract_duration: "계약 기간",
  payment_amount: "대금",
  special_terms: "특약사항",
  termination_conditions: "해지 조건",
  effective_date: "시작일",
  expiration_date: "종료일",
  work_display: "저작물 표시",
  work_names: "저작물명",
  institution: "기관",
  work_details: "상세정보",
  copyright_license: "저작재산권 이용허락",
  license_purpose: "허락 목적",
  licensing_institution: "허락 기관",
  public_nuri_license: "공공누리 라이선스",
  nuri_type: "공공누리 유형",
  modification_rights: "변경 권리",
  integrity_right_waiver: "동일성유지권 포기",
  modification_allowed: "변경 허용",
  conditions: "조건",
  personal_info_consent: "개인정보 동의",
  utilizing_institution: "활용기관",
  processing_info: "처리정보",
  checkbox_info: "체크박스 정보",
  checkbox_pattern_detected: "패턴",
  extraction_confidence: "추출 신뢰도",
  checkbox_fields_found: "감지된 항목",
  withdrawal_rights: "철회 권리",
  consequences_of_refusal: "거절 시 결과",
  contract_terms: "계약 조건",
  contract_type_selection: "계약 유형",
  exclusive: "독점적",
  non_exclusive: "비독점적",
  payment_terms: "대금 지급 조건",
  prepaid: "선불",
  postpaid: "후불",
  installment: "분할 지급",
  renewal_options: "갱신 조건",
  auto_renewal: "자동 갱신",
  manual_renewal: "수동 갱신",
  payment_currency: "통화",
  available_types: "사용 가능 유형",
  detailed_info: "상세정보",
  stage: "무대",
  lighting: "조명",
  costume: "의상",
  accessories: "장신구",
  props: "소품",
  sound: "음향",
  video: "영상",
  meditation: "명상",
  lighting_equipment: "조명장비",
  license_type: "라이선스 유형",
}

function getLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

/** 값이 실제로 존재하는지 재귀 판정 (null/undefined/""/"-"/공백, 전체 빈 객체·배열 모두 false) */
function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === "string") {
    const t = v.trim()
    return t !== "" && t !== "-"
  }
  if (typeof v === "number" || typeof v === "boolean") return true
  if (Array.isArray(v)) return v.some(hasValue)
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(hasValue)
  return false
}

/** 실제 값이 있는 항목 개수 — 객체는 값이 있는 키 수, 배열은 값이 있는 원소 수 */
function countMeaningful(data: unknown): number {
  if (Array.isArray(data)) return data.filter(hasValue).length
  if (data && typeof data === "object") {
    return Object.values(data as Record<string, unknown>).filter(hasValue).length
  }
  return hasValue(data) ? 1 : 0
}

/** JSONB 동적 렌더러 - 중첩 객체/배열 지원 */
function JsonRenderer({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) return <EmptyValue />

  if (typeof data === "boolean") {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${data ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
        {data ? "✓ 해당" : "— 해당없음"}
      </span>
    )
  }

  if (typeof data === "number") {
    return <span className="text-sm text-gray-900">{data}</span>
  }

  if (typeof data === "string") {
    return <span className="text-sm text-gray-900">{data}</span>
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <EmptyValue />
    // 문자열 배열
    if (typeof data[0] === "string") {
      return (
        <div className="flex flex-wrap gap-1.5">
          {data.map((item, i) => (
            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-700">
              {String(item)}
            </span>
          ))}
        </div>
      )
    }
    // 객체 배열 (parties 등)
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
            <JsonRenderer data={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    )
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <div className={`space-y-2 ${depth > 0 ? "" : ""}`}>
        {entries.map(([key, value]) => {
          const isNested = typeof value === "object" && value !== null && !Array.isArray(value)
          const isArray = Array.isArray(value)
          return (
            <div key={key}>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-gray-500 flex-shrink-0">{getLabel(key)}</span>
                {!isNested && !isArray && (
                  <div className="flex-1 min-w-0">
                    <JsonRenderer data={value} depth={depth + 1} />
                  </div>
                )}
              </div>
              {(isNested || isArray) && (
                <div className="ml-3 mt-1 pl-3 border-l-2 border-gray-100">
                  <JsonRenderer data={value} depth={depth + 1} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return <span className="text-sm text-gray-900">{String(data)}</span>
}

/** ── 테이블 형태 메타데이터 뷰어/에디터 (계약서용) ── */
function MetadataTable({
  data,
  editing,
  form,
  onChange,
}: {
  data: Record<string, unknown>
  editing: boolean
  form: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  // 내부 처리 필드 제외
  const HIDDEN_KEYS = new Set([
    "checkbox_info", "processing_info", "checkbox_pattern_detected",
    "extraction_confidence", "checkbox_fields_found", "pattern_detected",
  ])
  const entries = Object.entries(data).filter(([k]) => !HIDDEN_KEYS.has(k))
  const simpleEntries = entries.filter(
    ([, v]) => typeof v !== "object" || v === null
  )
  const complexEntries = entries.filter(
    ([, v]) => typeof v === "object" && v !== null
  )

  return (
    <div className="space-y-4">
      {/* 단순 필드 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 w-[160px]">항목</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">값</th>
            </tr>
          </thead>
          <tbody>
            {simpleEntries.map(([key, value]) => (
              <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2.5 text-sm text-gray-500 font-medium align-top">{getLabel(key)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-900">
                  {editing ? (
                    typeof value === "boolean" ? (
                      <select
                        value={form[key] ?? (value ? "true" : "false")}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="true">해당</option>
                        <option value="false">해당없음</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form[key] ?? String(value ?? "")}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )
                  ) : value === null || value === undefined || value === "" ? (
                    <span className="text-gray-400 italic">미식별</span>
                  ) : typeof value === "boolean" ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {value ? "해당" : "해당없음"}
                    </span>
                  ) : (
                    String(value)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 중첩 객체/배열 - 접힘 가능 */}
      {complexEntries.map(([key, value]) => (
        <CollapsibleSection key={key} label={getLabel(key)} data={value} editing={editing} form={form} onChange={onChange} prefix={key} />
      ))}
    </div>
  )
}

/** 접힘/펼침 가능한 하위 섹션 */
function CollapsibleSection({
  label,
  data,
  editing,
  form,
  onChange,
  prefix,
}: {
  label: string
  data: unknown
  editing: boolean
  form: Record<string, string>
  onChange: (key: string, value: string) => void
  prefix: string
}) {
  const [open, setOpen] = useState(true)
  const count = countMeaningful(data)

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">
          {open ? "▼" : "▶"} {label}
          {count > 0 && <span className="ml-1 text-gray-500">({count}건)</span>}
        </span>
      </button>
      {open && (
        <div className="p-3">
          {Array.isArray(data) ? (
            <div className="space-y-2">
              {data.map((item, i) => (
                <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
                  {typeof item === "object" && item !== null ? (
                    <table className="w-full">
                      <tbody>
                        {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                          <tr key={k} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-xs text-gray-500 font-medium w-[120px] align-top">{getLabel(k)}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-900">
                              {editing ? (
                                <input
                                  type="text"
                                  value={form[`${prefix}.${i}.${k}`] ?? String(v ?? "")}
                                  onChange={(e) => onChange(`${prefix}.${i}.${k}`, e.target.value)}
                                  className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              ) : v === null || v === undefined ? (
                                <span className="text-gray-400 italic">-</span>
                              ) : (
                                String(v)
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-3 py-1.5 text-xs text-gray-900">{String(item)}</div>
                  )}
                </div>
              ))}
            </div>
          ) : typeof data === "object" && data !== null ? (
            <table className="w-full">
              <tbody>
                {Object.entries(data as Record<string, unknown>).map(([k, v]) => (
                  <tr key={k} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-sm text-gray-500 font-medium w-[140px] align-top">{getLabel(k)}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-900">
                      {typeof v === "object" && v !== null ? (
                        <CollapsibleSection label={getLabel(k)} data={v} editing={editing} form={form} onChange={onChange} prefix={`${prefix}.${k}`} />
                      ) : editing ? (
                        typeof v === "boolean" ? (
                          <select
                            value={form[`${prefix}.${k}`] ?? (v ? "true" : "false")}
                            onChange={(e) => onChange(`${prefix}.${k}`, e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="true">해당</option>
                            <option value="false">해당없음</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={form[`${prefix}.${k}`] ?? String(v ?? "")}
                            onChange={(e) => onChange(`${prefix}.${k}`, e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        )
                      ) : v === null || v === undefined ? (
                        <span className="text-gray-400 italic">-</span>
                      ) : typeof v === "boolean" ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {v ? "해당" : "해당없음"}
                        </span>
                      ) : (
                        String(v)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      )}
    </div>
  )
}

/** ── 저작물 메타데이터 테이블 (20개 항목) ── */
function WorkMetadataTable({
  work,
  contractFilename,
  editing,
  form,
  onChange,
}: {
  work: Work
  contractFilename: string | null
  editing: boolean
  form: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const sections = [
    {
      title: "저작물정보",
      color: "border-l-blue-500",
      fields: [
        { key: "work_name", label: "저작물명", value: work.work_name },
        { key: "work_type", label: "유형", value: work.work_type ? (WORK_TYPE_LABELS[work.work_type] ?? work.work_type) : null },
        { key: "digital_format", label: "디지털화형태", value: work.digital_format },
        { key: "description", label: "설명", value: work.description },
        { key: "keywords", label: "주제어", value: work.keywords?.join(", ") || null },
        { key: "language", label: "언어", value: work.language },
        { key: "created_date", label: "제작일", value: work.created_date },
        { key: "creator", label: "계약서", value: contractFilename },
      ],
    },
    {
      title: "저작자정보",
      color: "border-l-green-500",
      fields: [
        { key: "copyright_holder", label: "저작권자", value: work.copyright_holder },
        { key: "co_authors", label: "공동저작자", value: work.co_authors },
        { key: "neighboring_rights_holder", label: "저작인접권자", value: work.neighboring_rights_holder },
      ],
    },
    {
      title: "권리정보",
      color: "border-l-amber-500",
      fields: [
        { key: "disclosure_type", label: "공개유형", value: work.disclosure_type },
        { key: "copyrightability", label: "저작물성", value: work.copyrightability },
        { key: "non_protected_work", label: "비보호저작물", value: work.non_protected_work },
        { key: "work_for_hire", label: "업무상저작물", value: work.work_for_hire },
        { key: "commercial_use", label: "상업적이용허락", value: work.commercial_use },
        { key: "property_rights", label: "저작재산권", value: work.property_rights },
        { key: "co_author_consent", label: "공동저작자동의", value: work.co_author_consent },
        { key: "validity_period", label: "유효기간", value: work.validity_period },
        { key: "portrait_rights", label: "초상권", value: work.portrait_rights },
      ],
    },
  ]

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title} className={`bg-white border border-gray-200 rounded-lg overflow-hidden border-l-4 ${section.color}`}>
          <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <span className="text-sm font-bold text-gray-700">{section.title}</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 w-[140px]">항목</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">값</th>
              </tr>
            </thead>
            <tbody>
              {section.fields.map((field) => (
                <tr key={field.key} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-500 font-medium align-top">{field.label}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {editing && field.key !== "creator" ? (
                      <input
                        type="text"
                        value={form[field.key] ?? String(field.value ?? "")}
                        onChange={(e) => onChange(field.key, e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    ) : field.value === null || field.value === undefined || field.value === "" ? (
                      <span className="text-gray-400 italic">미식별</span>
                    ) : (
                      field.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

/** JSON을 flat key-value로 변환 (예: "parties.0.name" → "박동우") */
function flattenJson(data: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value === null || value === undefined) {
      result[fullKey] = ""
    } else if (typeof value === "boolean") {
      result[fullKey] = value ? "true" : "false"
    } else if (typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value as Record<string, unknown>, fullKey))
    } else if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "string") {
        result[fullKey] = value.join(", ")
      } else {
        value.forEach((item, i) => {
          if (typeof item === "object" && item !== null) {
            Object.assign(result, flattenJson(item as Record<string, unknown>, `${fullKey}.${i}`))
          } else {
            result[`${fullKey}.${i}`] = String(item ?? "")
          }
        })
      }
    } else {
      result[fullKey] = String(value)
    }
  }
  return result
}

/** 수정 가능한 JSON 렌더러 */
function EditableJsonRenderer({
  data,
  form,
  onChange,
  prefix = "",
  depth = 0,
}: {
  data: unknown
  form: Record<string, string>
  onChange: (key: string, value: string) => void
  prefix?: string
  depth?: number
}) {
  if (typeof data !== "object" || data === null) return null

  if (Array.isArray(data)) {
    if (data.length === 0) return <EmptyValue />
    if (typeof data[0] === "string") {
      const fullKey = prefix
      return (
        <input
          type="text"
          value={form[fullKey] ?? data.join(", ")}
          onChange={(e) => onChange(fullKey, e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      )
    }
    return (
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <EditableJsonRenderer
              data={item}
              form={form}
              onChange={onChange}
              prefix={prefix ? `${prefix}.${i}` : `${i}`}
              depth={depth + 1}
            />
          </div>
        ))}
      </div>
    )
  }

  const entries = Object.entries(data as Record<string, unknown>)
  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key
        const isNested = typeof value === "object" && value !== null && !Array.isArray(value)
        const isArray = Array.isArray(value)
        const isLeaf = !isNested && !isArray

        return (
          <div key={key}>
            <label className="text-sm text-gray-500 mb-1 block">{getLabel(key)}</label>
            {isLeaf ? (
              typeof value === "boolean" ? (
                <select
                  value={form[fullKey] ?? (value ? "true" : "false")}
                  onChange={(e) => onChange(fullKey, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="true">해당</option>
                  <option value="false">해당없음</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={form[fullKey] ?? String(value ?? "")}
                  onChange={(e) => onChange(fullKey, e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              )
            ) : (
              <div className="ml-3 pl-3 border-l-2 border-gray-100">
                <EditableJsonRenderer
                  data={value}
                  form={form}
                  onChange={onChange}
                  prefix={fullKey}
                  depth={depth + 1}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
