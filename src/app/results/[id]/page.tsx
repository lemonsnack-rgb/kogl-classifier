"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import AppLayout from "@/components/layout/AppLayout"
import { getContractById } from "@/lib/mock/data"
import { KOGL_TYPES, STATUS_META } from "@/types"
import type { KoglType, ContractStatus, ClauseType, Work } from "@/types"

const CLAUSE_TYPE_LABELS: Record<ClauseType, string> = {
  OWNERSHIP: "소유권/귀속",
  LICENSE: "이용허락",
  DERIVATIVE: "2차적 저작물",
  SCOPE: "이용범위",
  TERM: "기간",
  ATTRIBUTION: "출처표시",
}

const BASIS_LABELS: Record<string, string> = {
  CONTRACT: "계약서 기반 자동 분류",
  AI: "AI 자동 분류",
  MANUAL: "수동 분류",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export default function ResultDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const contract = getContractById(id)

  const [openAccordions, setOpenAccordions] = useState<Record<number, boolean>>(
    { 0: true }
  )

  if (!contract) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">데이터가 없습니다.</p>
            <Link
              href="/results"
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
        <Link
          href="/results"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          목록으로
        </Link>

        {/* ======== 계약서 정보 카드 ======== */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            계약서 정보
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <InfoField
              label="파일명"
              value={contract.contract_filename ?? "(파일 없음)"}
            />
            <InfoField label="등록일" value={formatDate(contract.created_at)} />
            <InfoField label="등록자" value="홍길동 (mock)" />
            <InfoField
              label="상태"
              value={
                <StatusBadge status={contract.status} />
              }
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
              href={`/results/${id}/edit`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              수정
            </Link>
          </div>

          {contract.gongnuri_type ? (
            <>
              {/* KOGL 유형 뱃지 + 신뢰도 + 판정근거 */}
              <div className="flex flex-wrap items-start gap-6 mb-6">
                {/* 큰 뱃지 */}
                <div className="flex flex-col items-center gap-2">
                  <KoglBadgeLarge type={contract.gongnuri_type} />
                  <span className="text-xs text-gray-500">
                    {KOGL_TYPES[contract.gongnuri_type].description}
                  </span>
                </div>

                {/* 신뢰도 */}
                <div className="flex-1 min-w-[200px]">
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

                {/* 판정근거 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">판정 근거</p>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                    {BASIS_LABELS[contract.classification_basis ?? ""] ??
                      contract.classification_basis ??
                      "-"}
                  </span>
                </div>
              </div>

              {/* 판단 근거 섹션 */}
              {clauses.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
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
            <Link
              href={`/results/${id}/edit`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-md hover:bg-primary-50 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              수정
            </Link>
          </div>

          {works.length === 0 ? (
            <p className="text-gray-400 text-sm">등록된 저작물이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {works.map((work, idx) => (
                <WorkAccordion
                  key={work.id}
                  work={work}
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

const WORK_TYPE_LABELS: Record<string, string> = {
  image: "이미지",
  text: "텍스트",
  audio: "오디오",
  video: "영상",
}

function WorkAccordion({
  work,
  index,
  isOpen,
  onToggle,
}: {
  work: Work
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
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* 본문 */}
      {isOpen && (
        <div className="px-4 py-4 space-y-5 text-sm">
          {/* 저작물 정보 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              저작물 정보
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
              <InfoField
                label="저작물명"
                value={work.work_name ?? "-"}
              />
              <InfoField
                label="유형"
                value={
                  work.work_type
                    ? WORK_TYPE_LABELS[work.work_type] ?? work.work_type
                    : "-"
                }
              />
              <InfoField
                label="디지털화 형태"
                value={work.digital_format ?? "-"}
              />
              <InfoField
                label="설명"
                value={work.description ?? "-"}
              />
              <InfoField
                label="주제어"
                value={
                  work.keywords && work.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {work.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )
                }
              />
              <InfoField label="언어" value={work.language ?? "-"} />
              <InfoField
                label="제작일"
                value={work.created_date ?? "-"}
              />
              <InfoField label="저작자" value={work.creator ?? "-"} />
            </div>
          </div>

          {/* 권리정보 */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              권리정보
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
              <InfoField
                label="저작권 기간"
                value={work.copyright_period ?? "-"}
              />
              <InfoField
                label="이용범위"
                value={work.usage_scope ?? "-"}
              />
              <InfoField
                label="지역구분"
                value={work.usage_territory ?? "-"}
              />
            </div>
          </div>

          {/* 계약서 추출 정보 */}
          {meta && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                계약서 추출 정보
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                <InfoField
                  label="양수자 기관명"
                  value={meta.assignee_org ?? "-"}
                />
                <InfoField
                  label="양도자명"
                  value={meta.assignor_name ?? "-"}
                />
                <InfoField
                  label="동의여부"
                  value={meta.consent_status ?? "-"}
                />
                <InfoField
                  label="날짜"
                  value={meta.consent_date ?? "-"}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
