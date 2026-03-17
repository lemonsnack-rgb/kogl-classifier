"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { FileSearch, Settings, User, LogOut, ExternalLink } from "lucide-react"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types"

const topMenuItems = [
  { href: "/works", label: "검사하기", icon: FileSearch },
]

const externalLinks = [
  { href: "https://www.kogl.or.kr/index.do", label: "공공누리" },
  { href: "https://www.kcisa.kr/", label: "한국문화정보원" },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userRole, setUserRole] = useState<UserRole>("user")
  const [userName, setUserName] = useState("")

  useEffect(() => {
    if (isSupabaseConfigured()) {
      const fetchProfile = async () => {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("role, name, organization")
              .eq("id", user.id)
              .single()
            if (profile?.role) {
              setUserRole(profile.role as UserRole)
            }
            const org = profile?.organization || ""
            const name = profile?.name || user.email || ""
            setUserName(org ? `${org} ${name}` : name)
          }
        } catch {
          // ignore
        }
      }
      fetchProfile()
    } else {
      try {
        const stored = localStorage.getItem("user")
        if (stored) {
          const user = JSON.parse(stored)
          if (user.role) setUserRole(user.role)
          const org = user.organization || ""
          const name = user.name || user.email || ""
          setUserName(org ? `${org} ${name}` : name)
        }
      } catch {
        // ignore
      }
    }
  }, [])

  const handleLogout = async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } catch {
        // ignore
      }
    } else {
      localStorage.removeItem("user")
    }
    router.push("/login")
  }

  // 관리자 메뉴 표시 여부
  const bottomMenuItems = [
    ...(userRole === "admin"
      ? [{ href: "/admin/users", label: "관리자", icon: Settings }]
      : []),
    { href: "/mypage", label: "마이페이지", icon: User },
  ]

  return (
    <aside className="w-60 min-h-screen bg-primary-900 text-white flex flex-col">
      {/* 로고 + 사용자 정보 */}
      <div className="p-5 border-b border-primary-700">
        <Link href="/works" className="block">
          <div className="text-lg font-bold leading-tight">공공저작물</div>
          <div className="text-lg font-bold leading-tight">
            권리유형 자동분류 서비스
          </div>
        </Link>
        {userName && (
          <div className="mt-3 pt-3 border-t border-primary-700">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary-400" strokeWidth={1.5} />
              <span className="text-sm text-primary-200 truncate">{userName}</span>
            </div>
          </div>
        )}
      </div>

      {/* 상단 메뉴 */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {topMenuItems.map((item, index) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <li key={`${item.href}-${index}`}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-accent-600 text-white font-medium"
                      : "text-primary-200 hover:bg-primary-700 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* 바로가기 */}
        <div className="mt-6 pt-4 border-t border-primary-700 px-3">
          <div className="px-3 mb-2 text-xs font-medium text-primary-400 uppercase tracking-wider">
            바로가기
          </div>
          <ul className="space-y-1">
            {externalLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-primary-300 hover:bg-primary-700 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* 하단 메뉴 */}
      <div className="mt-auto border-t border-primary-700">
        <ul className="space-y-1 px-3 py-4">
          {bottomMenuItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-accent-600 text-white font-medium"
                      : "text-primary-200 hover:bg-primary-700 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                  {item.label}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors text-primary-200 hover:bg-primary-700 hover:text-white w-full text-left"
            >
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
              로그아웃
            </button>
          </li>
        </ul>
      </div>

      {/* 하단 서비스 제공자 정보 */}
      <div className="p-4 border-t border-primary-700 text-xs text-primary-400 space-y-0.5">
        <div>주관: 무하유</div>
        <div>참여: HM컴퍼니 · 숭실대 산학협력단</div>
        <div>수요: 한국문화정보원 · 한국저작권위원회</div>
      </div>
    </aside>
  )
}
