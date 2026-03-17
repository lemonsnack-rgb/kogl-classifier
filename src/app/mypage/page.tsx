"use client"

import { useState, useEffect } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"

export default function MyPage() {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [organization, setOrganization] = useState("")
  const [department, setDepartment] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured()) {
      const fetchProfile = async () => {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            setUserId(user.id)
            setEmail(user.email || "")

            const { data: profile } = await supabase
              .from("profiles")
              .select("name, organization, department")
              .eq("id", user.id)
              .single()

            if (profile) {
              setName(profile.name || "")
              setOrganization(profile.organization || "")
              setDepartment(profile.department || "")
            }
          }
        } catch {
          // ignore
        }
        setLoading(false)
      }
      fetchProfile()
    } else {
      // Mock 모드
      try {
        const stored = localStorage.getItem("user")
        if (stored) {
          const user = JSON.parse(stored)
          setEmail(user.email || "admin@kcii.go.kr")
          setName(user.name || "관리자")
          setOrganization(user.organization || "한국문화정보원")
          setDepartment(user.department || "문화데이터기획과")
        } else {
          setEmail("admin@kcii.go.kr")
          setName("관리자")
          setOrganization("한국문화정보원")
          setDepartment("문화데이터기획과")
        }
      } catch {
        setEmail("admin@kcii.go.kr")
        setName("관리자")
        setOrganization("한국문화정보원")
        setDepartment("문화데이터기획과")
      }
      setLoading(false)
    }
  }, [])

  const handleProfileSave = async () => {
    setSaving(true)

    if (isSupabaseConfigured() && userId) {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from("profiles")
          .update({
            name: name || null,
            organization: organization || null,
            department: department || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)

        if (error) {
          alert("프로필 저장 중 오류가 발생했습니다: " + error.message)
          setSaving(false)
          return
        }
        alert("프로필이 저장되었습니다.")
      } catch {
        alert("프로필 저장 중 오류가 발생했습니다.")
      }
    } else {
      // Mock 모드: localStorage 업데이트
      try {
        const stored = localStorage.getItem("user")
        const user = stored ? JSON.parse(stored) : {}
        user.name = name
        user.organization = organization
        user.department = department
        localStorage.setItem("user", JSON.stringify(user))
      } catch {
        // ignore
      }
      alert("프로필이 저장되었습니다.")
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-2xl">
          <div className="p-8 text-center text-sm text-gray-500">
            로딩 중...
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">마이페이지</h2>

        {/* 프로필 정보 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            프로필 정보
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소속기관
              </label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                소속부서
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={handleProfileSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-700 text-white rounded-md text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "프로필 저장"}
            </button>
          </div>
        </div>

        {/* 인증 안내 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            로그인 방식
          </h3>
          <p className="text-sm text-gray-600">
            이 서비스는 Magic Link 방식으로 로그인합니다. 로그인 시 이메일로 발송되는 링크를 클릭하여 접속할 수 있습니다. 별도의 비밀번호 설정이 필요하지 않습니다.
          </p>
        </div>

        {/* 내 업로드 통계 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            내 업로드 통계
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-700">5</div>
              <div className="text-xs text-gray-500 mt-1">전체 업로드</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-status-complete">3</div>
              <div className="text-xs text-gray-500 mt-1">완료</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-status-review">1</div>
              <div className="text-xs text-gray-500 mt-1">검토 필요</div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
