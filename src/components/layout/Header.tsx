"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Header() {
  const router = useRouter()
  const [email, setEmail] = useState("사용자")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user")
      if (stored) {
        const user = JSON.parse(stored)
        if (user.email) {
          setEmail(user.email)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("user")
    router.push("/login")
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-gray-900">
        공공저작물 권리유형 자동분류 서비스
      </h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{email}</span>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          로그아웃
        </button>
      </div>
    </header>
  )
}
