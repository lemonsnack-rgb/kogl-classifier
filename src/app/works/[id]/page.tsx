"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { getContractById } from "@/lib/mock/data"
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
  const contract = getContractById(id)

  const [selectedWorkIdx, setSelectedWorkIdx] = useState<number | null>(null)
  const [editingType, setEditingType] = useState(false)
  const [editingMeta, setEditingMeta] = useState(false)

  // 공공누리 유형 인라인 수정 상태
  const [editTypeValue, setEditTypeValue] = useState<KoglType | "">(
    contract?.gongnuri_type ?? ""
  )
  const [editTypeReason, setEditTypeReason] = useState("")

  // 메타데이터 인라인 수정 상태
  const [metaForm, setMetaForm] = useState<Record<string, string>>({})

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
            <LeftField label="등록자" value="홍길동 (mock)" />
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
                  className="h-[56px] w-auto object-contain rounded flex-shrink-0"
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
          {selectedWork === null ? (
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

              {/* 저작물정보 섹션 */}
              <MetaSection title="저작물정보" color="blue">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                  <MetaField
                    label="저작물명"
                    value={selectedWork.work_name}
                    editing={editingMeta}
                    editValue={metaForm.work_name}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, work_name: v }))
                    }
                  />
                  <MetaField
                    label="유형"
                    value={
                      selectedWork.work_type
                        ? (WORK_TYPE_LABELS[selectedWork.work_type] ??
                          selectedWork.work_type)
                        : null
                    }
                    editing={editingMeta}
                    editValue={metaForm.work_type}
                    editType="select"
                    selectOptions={[
                      { value: "", label: "선택" },
                      { value: "image", label: "이미지" },
                      { value: "text", label: "텍스트" },
                      { value: "audio", label: "오디오" },
                      { value: "video", label: "영상" },
                    ]}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, work_type: v }))
                    }
                  />
                  <MetaField
                    label="디지털화형태"
                    value={selectedWork.digital_format}
                    editing={editingMeta}
                    editValue={metaForm.digital_format}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, digital_format: v }))
                    }
                  />
                  <MetaField
                    label="설명"
                    value={selectedWork.description}
                    editing={editingMeta}
                    editValue={metaForm.description}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, description: v }))
                    }
                  />
                  <MetaField
                    label="주제어"
                    value={selectedWork.keywords?.join(", ") || null}
                    editing={editingMeta}
                    editValue={metaForm.keywords}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, keywords: v }))
                    }
                    placeholder="쉼표로 구분"
                  />
                  <MetaField
                    label="언어"
                    value={selectedWork.language}
                    editing={editingMeta}
                    editValue={metaForm.language}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, language: v }))
                    }
                  />
                  <MetaField
                    label="제작일"
                    value={selectedWork.created_date}
                    editing={editingMeta}
                    editValue={metaForm.created_date}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, created_date: v }))
                    }
                  />
                  <MetaField
                    label="계약서"
                    value={
                      contract.contract_filename ? (
                        <span className="inline-flex items-center gap-1.5">
                          {contract.contract_filename}
                          <button
                            onClick={handleFileDownload}
                            className="text-gray-400 hover:text-primary-600 transition-colors"
                            title="다운로드"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null
                    }
                    editing={false}
                  />
                </div>
              </MetaSection>

              {/* 저작자정보 섹션 */}
              <MetaSection title="저작자정보" color="green">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                  <MetaField
                    label="저작권자"
                    value={selectedWork.creator}
                    editing={editingMeta}
                    editValue={metaForm.creator}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, creator: v }))
                    }
                  />
                  <MetaField
                    label="공동저작자"
                    value={null}
                    editing={false}
                  />
                  <MetaField
                    label="저작인접권자"
                    value={null}
                    editing={false}
                  />
                </div>
              </MetaSection>

              {/* 권리정보 섹션 */}
              <MetaSection title="권리정보" color="amber">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
                  <MetaField label="공개유형" value={null} editing={false} />
                  <MetaField label="저작물성" value={null} editing={false} />
                  <MetaField
                    label="비보호저작물"
                    value={null}
                    editing={false}
                  />
                  <MetaField
                    label="업무상저작물"
                    value={null}
                    editing={false}
                  />
                  <MetaField
                    label="상업적이용허락"
                    value={selectedWork.usage_scope}
                    editing={editingMeta}
                    editValue={metaForm.usage_scope}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, usage_scope: v }))
                    }
                  />
                  <MetaField
                    label="저작재산권"
                    value={selectedWork.copyright_period}
                    editing={editingMeta}
                    editValue={metaForm.copyright_period}
                    onChange={(v) =>
                      setMetaForm((p) => ({ ...p, copyright_period: v }))
                    }
                  />
                  <MetaField
                    label="공동저작자동의"
                    value={
                      selectedWork.contract_metadata?.consent_status ?? null
                    }
                    editing={false}
                  />
                  <MetaField
                    label="유효기간"
                    value={selectedWork.copyright_period}
                    editing={false}
                  />
                  <MetaField label="초상권" value={null} editing={false} />
                </div>
              </MetaSection>
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
      className="inline-flex items-center px-4 py-1.5 rounded-md text-base font-bold text-white"
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
