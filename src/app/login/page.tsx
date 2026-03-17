"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
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
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (authError) {
          setError(authError.message)
          setLoading(false)
          return
        }
        setSuccess(
          "이메일을 확인해주세요. 로그인 링크가 발송되었습니다."
        )
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
                데모 모드: 아무 이메일로 로그인할 수 있습니다.
              </p>
            </div>
          )}

          {/* Magic Link 로그인 폼 */}
          <form onSubmit={handleLogin} className="space-y-4">
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

          {/* 하단 안내 */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">
              초대받은 사용자만 로그인할 수 있습니다
            </p>
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
