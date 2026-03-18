"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [name, setName] = useState("")
  const [organization, setOrganization] = useState("")
  const [department, setDepartment] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!email || !password || !passwordConfirm || !name || !organization) {
      setError("필수 항목을 모두 입력해주세요.")
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.")
      setLoading(false)
      return
    }

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.")
      setLoading(false)
      return
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()

        // 회원가입
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            setError("이미 등록된 이메일입니다.")
          } else {
            setError(signUpError.message)
          }
          setLoading(false)
          return
        }

        // profiles 테이블 업데이트 (trigger가 row를 생성하므로 UPDATE만)
        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              name,
              organization,
              department: department || null,
            })
            .eq("id", data.user.id)

          if (profileError) {
            console.error("Profile update error:", profileError)
          }
        }

        // 가입 후 세션 정리 (승인 전이므로 로그아웃)
        await supabase.auth.signOut()

        setSuccess(true)
      } catch {
        setError("회원가입 중 오류가 발생했습니다.")
      }
    } else {
      // Mock 모드
      alert("가입 완료")
      router.push("/login")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 회원가입 카드 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          {/* 서비스 로고 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-900 rounded-lg mb-4">
              <span className="text-white text-lg font-bold">K</span>
            </div>
            <h1 className="text-xl font-bold text-primary-900">회원가입</h1>
            <p className="mt-2 text-sm text-gray-500">
              가입 후 관리자 승인이 완료되면 서비스를 이용할 수 있습니다
            </p>
          </div>

          {success ? (
            /* 가입 완료 메시지 */
            <div className="text-center">
              <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-700 font-medium">
                  가입이 완료되었습니다.
                </p>
                <p className="text-sm text-green-600 mt-1">
                  관리자 승인 후 로그인할 수 있습니다.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block px-6 py-2.5 bg-primary-700 text-white rounded-md text-sm font-medium hover:bg-primary-800 transition-colors"
              >
                로그인 페이지로 이동
              </Link>
            </div>
          ) : (
            /* 회원가입 폼 */
            <>
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    이메일 <span className="text-red-500">*</span>
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

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8자 이상 입력하세요"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label
                    htmlFor="passwordConfirm"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    비밀번호 확인 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="passwordConfirm"
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="비밀번호를 다시 입력하세요"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="홍길동"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="organization"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    소속기관 <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="organization"
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    placeholder="한국문화정보원"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="department"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    소속부서
                  </label>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="저작권관리팀"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  {loading ? "가입 처리 중..." : "회원가입"}
                </button>
              </form>

              {/* 로그인 링크 */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">
                  이미 계정이 있으신가요?{" "}
                  <Link
                    href="/login"
                    className="text-primary-700 font-medium hover:text-primary-800"
                  >
                    로그인
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* 하단 컨소시엄 정보 */}
        <div className="mt-6 text-center text-xs text-gray-400">
          무하유 · HM컴퍼니 · 숭실대 산학협력단
        </div>
      </div>
    </div>
  )
}
