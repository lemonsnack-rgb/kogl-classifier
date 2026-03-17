"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { getContractById } from "@/lib/mock/data"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { KoglType, ContractStatus, ClauseType, Work } from "@/types"
import {
  Download,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Edit,
  FileText,
  Pencil,
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
  const router = useRouter()
  const id = params.id as string
  const contract = getContractById(id)

  // 모든 아코디언 접힌 상태로 시작
  const [openAccordions, setOpenAccordions] = useState<
    Record<number, boolean>
  >({})

  if (!contract) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
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

  function toggleAccordion(idx: number) {
    setOpenAccordions((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* 뒤로가기 */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/works"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Link>
        </div>

        {/* ======== 검사제목 ======== */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          {contract.inspection_title
            ?? contract.contract_filename
            ?? "검사 결과"}
        </h1>

        {/* ======== 계약서 정보 카드 ======== */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            계약서 정보
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <InfoField
              label="파일명"
              value={
                contract.contract_filename ? (
                  <span className="inline-flex items-center gap-1.5">
                    {contract.contract_filename}
                    <button
                      onClick={handleFileDownload}
                      className="text-gray-400 hover:text-primary-600 transition-colors"
                      title="다운로드"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ) : (
                  "(파일 없음)"
                )
              }
            />
            <InfoField label="등록일" value={formatDate(contract.created_at)} />
            <InfoField label="등록자" value="홍길동 (mock)" />
            <InfoField
              label="상태"
              value={<StatusBadge status={contract.status} />}
            />
            <InfoField
              label="자체제작 여부"
              value={contract.is_institution_made ? "자체 제작" : "외부 위탁"}
            />
          </div>
        </section>

        {/* ======== 공공누리 유형 분류 결과 카드 ======== */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              공공누리 유형 분류 결과
            </h2>
            <Link
              href={`/works/${id}/edit?mode=type`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              유형 수정
            </Link>
          </div>

          {contract.gongnuri_type ? (
            <>
              {/* KOGL 유형 이미지 + 유형명/설명/신뢰도 수평 배치 */}
              <div className="flex items-start gap-6 mb-6">
                {/* 공공누리마크 이미지 (좌측 크게) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getKoglImageSrc(contract.gongnuri_type)}
                  alt={`공공누리 ${KOGL_TYPES[contract.gongnuri_type].label}`}
                  className="h-[80px] w-auto object-contain rounded flex-shrink-0"
                />

                {/* 우측: 유형명 + 설명 + 신뢰도 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <KoglBadgeLarge type={contract.gongnuri_type} />
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {KOGL_TYPES[contract.gongnuri_type].description}
                  </p>

                  {/* 신뢰도 */}
                  <p className="text-xs text-gray-500 mb-1.5">신뢰도</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(contract.gongnuri_confidence ?? 0) * 100}%`,
                          backgroundColor:
                            KOGL_TYPES[contract.gongnuri_type].color,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 tabular-nums">
                      {((contract.gongnuri_confidence ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {/* Top-K */}
                  {contract.gongnuri_top_k && (
                    <div className="mt-3 space-y-1">
                      {contract.gongnuri_top_k.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center gap-2 text-xs text-gray-500"
                        >
                          <span className="w-14 font-medium">
                            {KOGL_TYPES[item.label as KoglType]?.label ??
                              item.label}
                          </span>
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${item.score * 100}%`,
                                backgroundColor:
                                  KOGL_TYPES[item.label as KoglType]?.color ??
                                  "#9CA3AF",
                              }}
                            />
                          </div>
                          <span className="w-12 text-right tabular-nums">
                            {(item.score * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 판단 근거 섹션 */}
              {clauses.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-gray-400" />
                    판단 근거 조항
                  </h3>
                  <div className="space-y-4">
                    {clauses.map((clause) => (
                      <div
                        key={clause.id}
                        className="border border-gray-100 rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-50 text-primary-700">
                            {CLAUSE_TYPE_LABELS[clause.clause_type] ??
                              clause.clause_type}
                          </span>
                          <span className="text-xs text-gray-400 tabular-nums">
                            매칭 점수{" "}
                            <span className="font-semibold text-gray-600">
                              {(clause.match_score * 100).toFixed(0)}%
                            </span>
                          </span>
                        </div>
                        {/* 인용문 */}
                        <blockquote className="border-l-4 border-accent-500 bg-accent-50 pl-4 py-2 my-2 text-sm italic text-gray-700 leading-relaxed">
                          &ldquo;{clause.clause_text}&rdquo;
                        </blockquote>
                        <div className="flex gap-4 text-xs text-gray-400 mt-2">
                          {clause.page_number != null && (
                            <span>페이지 {clause.page_number}</span>
                          )}
                          {clause.char_start != null &&
                            clause.char_end != null && (
                              <span>
                                문자 위치 {clause.char_start}~{clause.char_end}
                              </span>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm">
              아직 분류 결과가 없습니다.
            </p>
          )}
        </section>

        {/* ======== 저작물 메타데이터 목록 카드 ======== */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              저작물 메타데이터
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({works.length}건)
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {/* 엑셀 다운로드 버튼 */}
              <button
                onClick={() =>
                  downloadCsv(works, contract.contract_filename)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                엑셀 다운로드
              </button>
            </div>
          </div>

          {works.length === 0 ? (
            <p className="text-gray-400 text-sm">등록된 저작물이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {works.map((work, idx) => (
                <WorkAccordion
                  key={work.id}
                  work={work}
                  contractId={id}
                  contractFilename={contract.contract_filename}
                  index={idx}
                  isOpen={!!openAccordions[idx]}
                  onToggle={() => toggleAccordion(idx)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}

/* ====================================================
   Sub Components
==================================================== */

function InfoField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <div className="text-sm text-gray-800 font-medium">{value}</div>
    </div>
  )
}

function KoglBadgeLarge({ type }: { type: KoglType }) {
  const meta = KOGL_TYPES[type]
  return (
    <span
      className="inline-flex items-center px-4 py-2 rounded-lg text-base font-bold text-white"
      style={{ backgroundColor: meta.color }}
    >
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: ContractStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
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

/** 값이 없으면 회색 "미식별" 표시 */
function MetaValue({ value }: { value: React.ReactNode }) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "-"
  ) {
    return <span className="text-gray-400 italic">미식별</span>
  }
  return <>{value}</>
}

function WorkAccordion({
  work,
  contractId,
  contractFilename,
  index,
  isOpen,
  onToggle,
}: {
  work: Work
  contractId: string
  contractFilename: string | null
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const meta = work.contract_metadata
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary-100 text-primary-700 text-xs font-bold">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-800">
            {work.work_filename}
          </span>
          {work.work_type && (
            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">
              {WORK_TYPE_LABELS[work.work_type] ?? work.work_type}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleFileDownload()
            }}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title="파일 다운로드"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* 개별 저작물 메타데이터 수정 버튼 */}
          <Link
            href={`/works/${contractId}/edit?mode=metadata&work=${work.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 border border-primary-200 rounded hover:bg-primary-50 transition-colors"
          >
            <Pencil className="w-3 h-3" />
            수정
          </Link>
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* 본문 - 3개 섹션으로 명확히 구분 */}
      {isOpen && (
        <div className="px-4 py-4 space-y-4 text-sm">
          {/* 저작물정보 섹션 */}
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-3">
              저작물정보
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
              <InfoField
                label="저작물명"
                value={<MetaValue value={work.work_name} />}
              />
              <InfoField
                label="유형"
                value={
                  <MetaValue
                    value={
                      work.work_type
                        ? (WORK_TYPE_LABELS[work.work_type] ?? work.work_type)
                        : null
                    }
                  />
                }
              />
              <InfoField
                label="디지털화형태"
                value={<MetaValue value={work.digital_format} />}
              />
              <InfoField
                label="설명"
                value={<MetaValue value={work.description} />}
              />
              <InfoField
                label="주제어"
                value={
                  work.keywords && work.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {work.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs"
                        >
                          #{kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <MetaValue value={null} />
                  )
                }
              />
              <InfoField
                label="언어"
                value={<MetaValue value={work.language} />}
              />
              <InfoField
                label="제작일"
                value={<MetaValue value={work.created_date} />}
              />
              <InfoField
                label="계약서"
                value={
                  contractFilename ? (
                    <span className="inline-flex items-center gap-1.5">
                      {contractFilename}
                      <button
                        onClick={handleFileDownload}
                        className="text-gray-400 hover:text-primary-600 transition-colors"
                        title="다운로드"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </span>
                  ) : (
                    <MetaValue value={null} />
                  )
                }
              />
            </div>
          </div>

          {/* 저작자정보 섹션 */}
          <div className="rounded-lg border border-green-100 bg-green-50/50 p-4">
            <h4 className="text-sm font-semibold text-green-800 mb-3">
              저작자정보
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
              <InfoField
                label="저작권자"
                value={<MetaValue value={work.creator} />}
              />
              <InfoField
                label="공동저작자"
                value={<MetaValue value={null} />}
              />
              <InfoField
                label="저작인접권자"
                value={<MetaValue value={null} />}
              />
            </div>
          </div>

          {/* 권리정보 섹션 */}
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
            <h4 className="text-sm font-semibold text-amber-800 mb-3">
              권리정보
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
              <InfoField
                label="공개유형"
                value={<MetaValue value={null} />}
              />
              <InfoField
                label="저작물성"
                value={<MetaValue value={null} />}
              />
              <InfoField
                label="비보호저작물"
                value={<MetaValue value={null} />}
              />
              <InfoField
                label="업무상저작물"
                value={<MetaValue value={null} />}
              />
              <InfoField
                label="상업적이용허락"
                value={<MetaValue value={work.usage_scope} />}
              />
              <InfoField
                label="저작재산권"
                value={<MetaValue value={work.copyright_period} />}
              />
              <InfoField
                label="공동저작자동의"
                value={<MetaValue value={meta?.consent_status} />}
              />
              <InfoField
                label="유효기간"
                value={<MetaValue value={work.copyright_period} />}
              />
              <InfoField
                label="초상권"
                value={<MetaValue value={null} />}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
