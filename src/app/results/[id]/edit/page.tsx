"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { getContractById } from "@/lib/mock/data"
import { KOGL_TYPES } from "@/types"
import type { KoglType, Work } from "@/types"

const KOGL_OPTIONS: { value: KoglType; label: string }[] = [
  { value: "KOGL-1", label: "제1유형 - 출처표시" },
  { value: "KOGL-2", label: "제2유형 - 출처표시 + 상업적 이용금지" },
  { value: "KOGL-3", label: "제3유형 - 출처표시 + 변경금지" },
  {
    value: "KOGL-4",
    label: "제4유형 - 출처표시 + 상업적 이용금지 + 변경금지",
  },
]

const WORK_TYPE_OPTIONS = [
  { value: "image", label: "이미지" },
  { value: "text", label: "텍스트" },
  { value: "audio", label: "오디오" },
  { value: "video", label: "영상" },
]

const CONSENT_OPTIONS = [
  { value: "동의", label: "동의 (Y)" },
  { value: "미동의", label: "미동의 (N)" },
]

interface WorkFormData {
  work_name: string
  work_type: string
  digital_format: string
  description: string
  keywords: string
  language: string
  created_date: string
  creator: string
  copyright_period: string
  usage_scope: string
  usage_territory: string
  assignee_org: string
  assignor_name: string
  consent_status: string
  consent_date: string
}

function workToFormData(work: Work): WorkFormData {
  return {
    work_name: work.work_name ?? "",
    work_type: work.work_type ?? "",
    digital_format: work.digital_format ?? "",
    description: work.description ?? "",
    keywords: work.keywords?.join(", ") ?? "",
    language: work.language ?? "",
    created_date: work.created_date ?? "",
    creator: work.creator ?? "",
    copyright_period: work.copyright_period ?? "",
    usage_scope: work.usage_scope ?? "",
    usage_territory: work.usage_territory ?? "",
    assignee_org: work.contract_metadata?.assignee_org ?? "",
    assignor_name: work.contract_metadata?.assignor_name ?? "",
    consent_status: work.contract_metadata?.consent_status ?? "",
    consent_date: work.contract_metadata?.consent_date ?? "",
  }
}

export default function ResultEditPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const contract = getContractById(id)

  const [koglType, setKoglType] = useState<KoglType | "">(
    contract?.gongnuri_type ?? ""
  )
  const [editReason, setEditReason] = useState("")
  const [activeWorkTab, setActiveWorkTab] = useState(0)
  const [workForms, setWorkForms] = useState<WorkFormData[]>([])

  useEffect(() => {
    if (contract?.works) {
      setWorkForms(contract.works.map(workToFormData))
    }
  }, [contract])

  if (!contract) {
    return (
      <AppLayout>
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">데이터가 없습니다.</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  const works = contract.works ?? []

  function handleWorkChange(
    field: keyof WorkFormData,
    value: string
  ) {
    setWorkForms((prev) => {
      const next = [...prev]
      next[activeWorkTab] = { ...next[activeWorkTab], [field]: value }
      return next
    })
  }

  function handleSave() {
    alert("저장되었습니다")
    router.push(`/results/${id}`)
  }

  function handleCancel() {
    router.push(`/results/${id}`)
  }

  const currentWork = workForms[activeWorkTab]

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* 상단 바 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">처리결과 수정</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
            >
              저장
            </button>
          </div>
        </div>

        {/* ======== 공공누리 유형 수정 ======== */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            공공누리 유형 수정
          </h2>

          {/* 현재 유형 표시 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">
              현재 유형
            </label>
            {contract.gongnuri_type ? (
              <span
                className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold text-white"
                style={{
                  backgroundColor:
                    KOGL_TYPES[contract.gongnuri_type].color,
                }}
              >
                {KOGL_TYPES[contract.gongnuri_type].label} -{" "}
                {KOGL_TYPES[contract.gongnuri_type].description}
              </span>
            ) : (
              <span className="text-sm text-gray-400">미분류</span>
            )}
          </div>

          {/* 유형 변경 Select */}
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">
              변경할 유형
            </label>
            <select
              value={koglType}
              onChange={(e) => setKoglType(e.target.value as KoglType | "")}
              className="w-full max-w-md border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">선택하세요</option>
              {KOGL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 수정 사유 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              수정 사유
            </label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="수정 사유를 입력하세요..."
              rows={3}
              className="w-full max-w-md border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </section>

        {/* ======== 저작물 메타데이터 수정 ======== */}
        <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            저작물 메타데이터 수정
          </h2>

          {works.length === 0 ? (
            <p className="text-gray-400 text-sm">등록된 저작물이 없습니다.</p>
          ) : (
            <>
              {/* 탭 */}
              <div className="flex items-center gap-1 mb-5 border-b border-gray-200 overflow-x-auto">
                {works.map((work, idx) => (
                  <button
                    key={work.id}
                    onClick={() => setActiveWorkTab(idx)}
                    className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeWorkTab === idx
                        ? "border-primary-600 text-primary-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    #{idx + 1} {work.work_filename}
                  </button>
                ))}
              </div>

              {/* 폼 */}
              {currentWork && (
                <div className="space-y-6">
                  {/* 저작물 정보 그룹 */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      저작물 정보
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="저작물명"
                        value={currentWork.work_name}
                        onChange={(v) => handleWorkChange("work_name", v)}
                      />
                      <FormSelect
                        label="유형"
                        value={currentWork.work_type}
                        options={WORK_TYPE_OPTIONS}
                        onChange={(v) => handleWorkChange("work_type", v)}
                      />
                      <FormInput
                        label="디지털화 형태"
                        value={currentWork.digital_format}
                        onChange={(v) => handleWorkChange("digital_format", v)}
                      />
                      <FormInput
                        label="언어"
                        value={currentWork.language}
                        onChange={(v) => handleWorkChange("language", v)}
                      />
                      <FormInput
                        label="제작일"
                        value={currentWork.created_date}
                        onChange={(v) => handleWorkChange("created_date", v)}
                        type="date"
                      />
                      <FormInput
                        label="저작자"
                        value={currentWork.creator}
                        onChange={(v) => handleWorkChange("creator", v)}
                      />
                      <FormInput
                        label="주제어"
                        value={currentWork.keywords}
                        onChange={(v) => handleWorkChange("keywords", v)}
                        placeholder="쉼표로 구분하여 입력"
                        fullWidth
                      />
                      <FormTextarea
                        label="설명"
                        value={currentWork.description}
                        onChange={(v) => handleWorkChange("description", v)}
                        fullWidth
                      />
                    </div>
                  </div>

                  {/* 권리정보 그룹 */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      권리정보
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="저작권 기간"
                        value={currentWork.copyright_period}
                        onChange={(v) =>
                          handleWorkChange("copyright_period", v)
                        }
                      />
                      <FormInput
                        label="이용범위"
                        value={currentWork.usage_scope}
                        onChange={(v) => handleWorkChange("usage_scope", v)}
                      />
                      <FormInput
                        label="지역구분"
                        value={currentWork.usage_territory}
                        onChange={(v) =>
                          handleWorkChange("usage_territory", v)
                        }
                      />
                    </div>
                  </div>

                  {/* 계약서 추출 정보 그룹 */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                      계약서 추출 정보
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormInput
                        label="양수자 기관명"
                        value={currentWork.assignee_org}
                        onChange={(v) => handleWorkChange("assignee_org", v)}
                      />
                      <FormInput
                        label="양도자명"
                        value={currentWork.assignor_name}
                        onChange={(v) => handleWorkChange("assignor_name", v)}
                      />
                      <FormSelect
                        label="동의여부"
                        value={currentWork.consent_status}
                        options={CONSENT_OPTIONS}
                        onChange={(v) =>
                          handleWorkChange("consent_status", v)
                        }
                      />
                      <FormInput
                        label="날짜"
                        value={currentWork.consent_date}
                        onChange={(v) => handleWorkChange("consent_date", v)}
                        type="date"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* 하단 저장 버튼 (모바일 편의) */}
        <div className="flex items-center justify-end gap-2 pb-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </AppLayout>
  )
}

/* ====================================================
   Form Components
==================================================== */

function FormInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  fullWidth,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  fullWidth?: boolean
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  )
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">선택하세요</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function FormTextarea({
  label,
  value,
  onChange,
  fullWidth,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  fullWidth?: boolean
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
      />
    </div>
  )
}
