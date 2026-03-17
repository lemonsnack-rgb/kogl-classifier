"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"

function getPageTitle(pathname: string): string {
  if (pathname === "/works") return "검사하기"
  if (pathname === "/works/new") return "새 문서 업로드"
  if (/^\/works\/[^/]+$/.test(pathname)) return "검사결과"
  if (pathname === "/mypage") return "마이페이지"
  if (pathname === "/admin/users") return "회원관리"
  return ""
}

export default function Header() {
  const pathname = usePathname()
  const [displayName, setDisplayName] = useState("사용자")

  useEffect(() => {
    if (isSupabaseConfigured()) {
      // Supabase 모드: auth + profiles 테이블에서 사용자 정보 조회
      const fetchUser = async () => {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            // profiles 테이블에서 organization, name 조회
            const { data: profile } = await supabase
              .from("profiles")
              .select("organization, name")
              .eq("id", user.id)
              .single()

            if (profile) {
              const parts: string[] = []
              if (profile.organization) parts.push(profile.organization)
              if (profile.name) parts.push(profile.name)
              if (parts.length > 0) {
                setDisplayName(parts.join(" "))
              } else {
                setDisplayName(user.email || "사용자")
              }
            } else {
              setDisplayName(user.email || "사용자")
            }
          }
        } catch {
          // 오류 시 기본값 유지
        }
      }
      fetchUser()
    } else {
      // Mock 모드: localStorage에서 사용자 정보 로드
      try {
        const stored = localStorage.getItem("user")
        if (stored) {
          const user = JSON.parse(stored)
          const parts: string[] = []
          if (user.organization) parts.push(user.organization)
          if (user.name) parts.push(user.name)
          if (parts.length > 0) {
            setDisplayName(parts.join(" "))
          } else if (user.email) {
            setDisplayName(user.email)
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [])

  const pageTitle = getPageTitle(pathname)

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-gray-900">
        {pageTitle}
      </h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{displayName}</span>
      </div>
    </header>
  )
}
