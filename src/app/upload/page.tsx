"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import AppLayout from "@/components/layout/AppLayout"

interface UploadedFile {
  file: File
  id: string
}

const STEPS = [
  { number: 1, label: "계약서/동의서 업로드" },
  { number: 2, label: "저작물 업로드" },
  { number: 3, label: "확인 및 제출" },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isInstitutionMade, setIsInstitutionMade] = useState(false)
  const [contractFile, setContractFile] = useState<UploadedFile | null>(null)
  const [workFiles, setWorkFiles] = useState<UploadedFile[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const contractInputRef = useRef<HTMLInputElement>(null)
  const workInputRef = useRef<HTMLInputElement>(null)

  // ========================================
  // 드래그 앤 드롭 핸들러
  // ========================================

  const handleContractDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (isInstitutionMade) return
      const file = e.dataTransfer.files[0]
      if (file) {
        setContractFile({ file, id: crypto.randomUUID() })
      }
    },
    [isInstitutionMade]
  )

  const handleContractFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setContractFile({ file, id: crypto.randomUUID() })
    }
    e.target.value = ""
  }

  const handleWorkDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const newFiles = files.map((f) => ({ file: f, id: crypto.randomUUID() }))
    setWorkFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleWorkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newFiles = files.map((f) => ({ file: f, id: crypto.randomUUID() }))
    setWorkFiles((prev) => [...prev, ...newFiles])
    e.target.value = ""
  }

  const removeWorkFile = (id: string) => {
    setWorkFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const preventDefault = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // ========================================
  // 스텝 이동
  // ========================================

  const canGoNext = () => {
    if (currentStep === 1) {
      return isInstitutionMade || contractFile !== null
    }
    if (currentStep === 2) {
      return workFiles.length > 0
    }
    return true
  }

  const handleNext = () => {
    if (canGoNext() && currentStep < 3) {
      setCurrentStep((s) => s + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // Mock 처리 시뮬레이션
    await new Promise((resolve) => setTimeout(resolve, 1500))
    router.push("/results")
  }

  // ========================================
  // 렌더링
  // ========================================

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 페이지 헤더 */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">문서 업로드</h2>
          <p className="text-sm text-gray-500 mt-1">
            계약서와 저작물을 업로드하여 공공누리 유형을 자동 분류합니다.
          </p>
        </div>

        {/* 스텝 인디케이터 */}
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    currentStep >= step.number
                      ? "bg-accent-600 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {currentStep > step.number ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium whitespace-nowrap ${
                    currentStep >= step.number
                      ? "text-accent-600"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`w-24 h-0.5 mx-2 mb-6 transition-colors ${
                    currentStep > step.number ? "bg-accent-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* 스텝 콘텐츠 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* ====== Step 1: 계약서/동의서 업로드 ====== */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  계약서/동의서 업로드
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  저작권 양도 계약서 또는 이용 허락 동의서 파일을 업로드하세요.
                </p>
              </div>

              {/* 기관 자체 제작물 체크박스 */}
              <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={isInstitutionMade}
                  onChange={(e) => {
                    setIsInstitutionMade(e.target.checked)
                    if (e.target.checked) {
                      setContractFile(null)
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-accent-600 focus:ring-accent-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    기관 자체 제작물입니다
                  </span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    기관에서 직접 제작한 저작물인 경우 계약서 업로드가 불필요합니다.
                  </p>
                </div>
              </label>

              {/* 드래그 앤 드롭 영역 */}
              <div
                onDrop={handleContractDrop}
                onDragOver={preventDefault}
                onDragEnter={preventDefault}
                onClick={() => {
                  if (!isInstitutionMade) contractInputRef.current?.click()
                }}
                className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  isInstitutionMade
                    ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-50"
                    : "border-gray-300 hover:border-accent-400 hover:bg-accent-50/30 cursor-pointer"
                }`}
              >
                <input
                  ref={contractInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif"
                  onChange={handleContractFileSelect}
                  className="hidden"
                  disabled={isInstitutionMade}
                />
                <div className="space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {isInstitutionMade
                        ? "기관 자체 제작물로 선택되어 비활성화됨"
                        : "파일을 드래그하여 놓거나 클릭하여 선택"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, JPG, PNG, TIFF 지원
                    </p>
                  </div>
                </div>
              </div>

              {/* 업로드된 계약서 파일 표시 */}
              {contractFile && !isInstitutionMade && (
                <div className="flex items-center justify-between p-3 bg-accent-50 rounded-lg border border-accent-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-accent-100 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-accent-600"
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
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {contractFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(contractFile.file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setContractFile(null)
                    }}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}

              {/* 다음 버튼 */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="px-6 py-2.5 bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* ====== Step 2: 저작물 업로드 ====== */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  저작물 업로드
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  분류할 저작물 파일을 업로드하세요. 여러 파일을 한 번에 선택할 수
                  있습니다.
                </p>
              </div>

              {/* 드래그 앤 드롭 영역 */}
              <div
                onDrop={handleWorkDrop}
                onDragOver={preventDefault}
                onDragEnter={preventDefault}
                onClick={() => workInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-accent-400 hover:bg-accent-50/30 rounded-xl p-10 text-center cursor-pointer transition-colors"
              >
                <input
                  ref={workInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.tif,.mp3,.mp4,.doc,.docx,.hwp"
                  onChange={handleWorkFileSelect}
                  className="hidden"
                />
                <div className="space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      파일을 드래그하여 놓거나 클릭하여 선택
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, JPG, PNG, TIFF, MP3, MP4, DOC, HWP 지원 (복수 선택
                      가능)
                    </p>
                  </div>
                </div>
              </div>

              {/* 업로드된 파일 목록 */}
              {workFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    업로드된 파일 ({workFiles.length}개)
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {workFiles.map((wf) => (
                      <div
                        key={wf.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <svg
                              className="w-4 h-4 text-gray-500"
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
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {wf.file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(wf.file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeWorkFile(wf.id)}
                          className="flex-shrink-0 ml-3 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 이전/다음 버튼 */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={handlePrev}
                  className="px-6 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  이전
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canGoNext()}
                  className="px-6 py-2.5 bg-accent-600 hover:bg-accent-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  다음
                </button>
              </div>
            </div>
          )}

          {/* ====== Step 3: 확인 및 제출 ====== */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  확인 및 제출
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  업로드할 파일을 확인하고 제출하세요.
                </p>
              </div>

              {/* 요약 */}
              <div className="space-y-4">
                {/* 계약서 정보 */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    계약서/동의서
                  </h4>
                  {isInstitutionMade ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
                        기관 자체 제작물
                      </span>
                      <span className="text-sm text-gray-500">
                        계약서 없음
                      </span>
                    </div>
                  ) : contractFile ? (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-accent-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4"
                        />
                      </svg>
                      <span className="text-sm text-gray-900">
                        {contractFile.file.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({formatFileSize(contractFile.file.size)})
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* 저작물 목록 */}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    저작물 ({workFiles.length}개)
                  </h4>
                  <ul className="space-y-1.5">
                    {workFiles.map((wf) => (
                      <li key={wf.id} className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 text-accent-600 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4"
                          />
                        </svg>
                        <span className="text-sm text-gray-900 truncate">
                          {wf.file.name}
                        </span>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          ({formatFileSize(wf.file.size)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 이전/제출 버튼 */}
              <div className="flex justify-between pt-4">
                <button
                  onClick={handlePrev}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                >
                  이전
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-accent-600 hover:bg-accent-700 disabled:bg-accent-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="animate-spin w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      처리중...
                    </>
                  ) : (
                    "제출하기"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
