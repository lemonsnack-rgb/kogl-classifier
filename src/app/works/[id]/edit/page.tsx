"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"
import { getContractById } from "@/lib/mock/data"
import { KOGL_TYPES } from "@/types"
import type { KoglType, Work } from "@/types"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

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

function WorkEditPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string
  const contract = getContractById(id)

  const mode = searchParams.get("mode") ?? "type"
  const workId = searchParams.get("work")

  const [koglType, setKoglType] = useState<KoglType | "">(
    contract?.gongnuri_type ?? ""
  )
  const [editReason, setEditReason] = useState("")
  const [workForm, setWorkForm] = useState<WorkFormData | null>(null)
  const [targetWork, setTargetWork] = useState<Work | null>(null)

  useEffect(() => {
    if (mode === "metadata" && workId && contract?.works) {
      const found = contract.works.find((w) => w.id === workId)
      if (found) {
        setTargetWork(found)
        setWorkForm(workToFormData(found))
      }
    }
  }, [mode, workId, contract])

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

  function handleWorkChange(field: keyof WorkFormData, value: string) {
    setWorkForm((prev) => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
  }

  function handleSave() {
    alert("저장되었습니다")
    router.push(`/works/${id}`)
  }

  function handleCancel() {
    router.push(`/works/${id}`)
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* 상단 바 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              href={`/works/${id}`}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4" />
              상세로 돌아가기
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {mode === "type" ? "공공누리 유형 수정" : "메타데이터 수정"}
            </h1>
          </div>
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

        {/* ======== mode=type: 공공누리 유형 수정 ======== */}
        {mode === "type" && (
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
                onChange={(e) =>
                  setKoglType(e.target.value as KoglType | "")
                }
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
        )}

        {/* ======== mode=metadata: 단일 저작물 메타데이터 수정 ======== */}
        {mode === "metadata" && (
          <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              저작물 메타데이터 수정
            </h2>
            {targetWork && (
              <p className="text-sm text-gray-500 mb-5">
                대상 파일: <span className="font-medium text-gray-700">{targetWork.work_filename}</span>
              </p>
            )}

            {!workForm ? (
              <p className="text-gray-400 text-sm">
                해당 저작물을 찾을 수 없습니다. 상세 페이지에서 저작물을 선택해주세요.
              </p>
            ) : (
              <div className="space-y-6">
                {/* 저작물 정보 그룹 */}
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                  <h3 className="text-sm font-semibold text-blue-800 mb-3">
                    저작물 정보
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="저작물명"
                      value={workForm.work_name}
                      onChange={(v) => handleWorkChange("work_name", v)}
                    />
                    <FormSelect
                      label="유형"
                      value={workForm.work_type}
                      options={WORK_TYPE_OPTIONS}
                      onChange={(v) => handleWorkChange("work_type", v)}
                    />
                    <FormInput
                      label="디지털화 형태"
                      value={workForm.digital_format}
                      onChange={(v) =>
                        handleWorkChange("digital_format", v)
                      }
                    />
                    <FormInput
                      label="언어"
                      value={workForm.language}
                      onChange={(v) => handleWorkChange("language", v)}
                    />
                    <FormInput
                      label="제작일"
                      value={workForm.created_date}
                      onChange={(v) =>
                        handleWorkChange("created_date", v)
                      }
                      type="date"
                    />
                    <FormInput
                      label="저작자"
                      value={workForm.creator}
                      onChange={(v) => handleWorkChange("creator", v)}
                    />
                    <FormInput
                      label="주제어"
                      value={workForm.keywords}
                      onChange={(v) => handleWorkChange("keywords", v)}
                      placeholder="쉼표로 구분하여 입력"
                      fullWidth
                    />
                    <FormTextarea
                      label="설명"
                      value={workForm.description}
                      onChange={(v) =>
                        handleWorkChange("description", v)
                      }
                      fullWidth
                    />
                  </div>
                </div>

                {/* 권리정보 그룹 */}
                <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4">
                  <h3 className="text-sm font-semibold text-amber-800 mb-3">
                    권리정보
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="저작권 기간"
                      value={workForm.copyright_period}
                      onChange={(v) =>
                        handleWorkChange("copyright_period", v)
                      }
                    />
                    <FormInput
                      label="이용범위"
                      value={workForm.usage_scope}
                      onChange={(v) =>
                        handleWorkChange("usage_scope", v)
                      }
                    />
                    <FormInput
                      label="지역구분"
                      value={workForm.usage_territory}
                      onChange={(v) =>
                        handleWorkChange("usage_territory", v)
                      }
                    />
                  </div>
                </div>

                {/* 계약서 추출 정보 그룹 */}
                <div className="rounded-lg border border-green-100 bg-green-50/50 p-4">
                  <h3 className="text-sm font-semibold text-green-800 mb-3">
                    계약서 추출 정보
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormInput
                      label="양수자 기관명"
                      value={workForm.assignee_org}
                      onChange={(v) =>
                        handleWorkChange("assignee_org", v)
                      }
                    />
                    <FormInput
                      label="양도자명"
                      value={workForm.assignor_name}
                      onChange={(v) =>
                        handleWorkChange("assignor_name", v)
                      }
                    />
                    <FormSelect
                      label="동의여부"
                      value={workForm.consent_status}
                      options={CONSENT_OPTIONS}
                      onChange={(v) =>
                        handleWorkChange("consent_status", v)
                      }
                    />
                    <FormInput
                      label="날짜"
                      value={workForm.consent_date}
                      onChange={(v) =>
                        handleWorkChange("consent_date", v)
                      }
                      type="date"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

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

export default function WorkEditPage() {
  return (
    <Suspense
      fallback={
        <AppLayout>
          <div className="max-w-5xl mx-auto">
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">로딩중...</p>
            </div>
          </div>
        </AppLayout>
      }
    >
      <WorkEditPageContent />
    </Suspense>
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
