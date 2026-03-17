"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isAdminMode, setIsAdminMode] = useState(false)

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    if (!email) {
      setError("이메일을 입력해주세요.")
      setLoading(false)
      return
    }

    if (isSupabaseConfigured()) {
      // Supabase 모드: Magic Link 발송
      try {
        const supabase = createClient()
        const { error: authError } = await supabase.auth.signInWithOtp({
          email,
        })
        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }
        setSuccess("로그인 링크가 이메일로 발송되었습니다. 메일함을 확인해주세요.")
      } catch {
        setError("로그인 링크 발송 중 오류가 발생했습니다.")
      }
    } else {
      // Mock 모드: 이메일만으로 로그인
      localStorage.setItem(
        "user",
        JSON.stringify({
          email,
          organization: "한국문화정보원",
          name: "김담당",
          role: "user",
        })
      )
      router.push("/works")
    }

    setLoading(false)
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.")
      setLoading(false)
      return
    }

    if (isSupabaseConfigured()) {
      // Supabase 모드: 비밀번호 인증
      try {
        const supabase = createClient()
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }
        router.push("/works")
      } catch {
        setError("로그인 중 오류가 발생했습니다.")
      }
    } else {
      // Mock 모드: 관리자 로그인
      localStorage.setItem(
        "user",
        JSON.stringify({
          email,
          organization: "한국문화정보원",
          name: "관리자",
          role: "admin",
        })
      )
      router.push("/works")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로그인 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* 서비스 로고 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-900 rounded-lg mb-4">
              <span className="text-white text-lg font-bold">K</span>
            </div>
            <h1 className="text-xl font-bold text-primary-900">공공저작물</h1>
            <h2 className="text-xl font-bold text-primary-900">
              권리유형 자동분류 서비스
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              계약서와 저작물을 업로드하여 공공누리 유형을 분류합니다
            </p>
          </div>

          {/* Mock 모드 안내 */}
          {!isSupabaseConfigured() && (
            <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-700">
                데모 모드: {isAdminMode ? "아무 이메일/비밀번호로 관리자 로그인할 수 있습니다." : "아무 이메일로 로그인할 수 있습니다."}
              </p>
            </div>
          )}

          {!isAdminMode ? (
            /* 일반 사용자 로그인: Magic Link */
            <form onSubmit={handleUserLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.go.kr"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary-700 text-white rounded-md text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
              >
                {loading ? "처리 중..." : "로그인 링크 발송"}
              </button>
            </form>
          ) : (
            /* 관리자 로그인: 이메일 + 비밀번호 */
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  이메일
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@organization.go.kr"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  비밀번호
                </label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary-700 text-white rounded-md text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50"
              >
                {loading ? "로그인 중..." : "관리자 로그인"}
              </button>
            </form>
          )}

          {/* 모드 전환 링크 */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setIsAdminMode(!isAdminMode)
                setError("")
                setSuccess("")
              }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {isAdminMode ? "일반 로그인으로 돌아가기" : "관리자 로그인"}
            </button>
          </div>
        </div>

        {/* 하단 컨소시엄 정보 */}
        <div className="mt-6 text-center text-xs text-gray-400">
          무하유 · HM컴퍼니 · 숭실대 산학협력단
        </div>
      </div>
    </div>
  )
}
