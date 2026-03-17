"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const menuItems = [
  { href: "/", label: "홈", icon: "🏠" },
  { href: "/upload", label: "문서 업로드", icon: "📤" },
  { href: "/results", label: "처리결과", icon: "📋" },
  { href: "/mypage", label: "마이페이지", icon: "👤" },
]

const adminItems = [
  { href: "/admin/users", label: "회원관리", icon: "⚙️" },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 min-h-screen bg-primary-900 text-white flex flex-col">
      {/* 로고 영역 */}
      <div className="p-5 border-b border-primary-700">
        <Link href="/" className="block">
          <div className="text-sm font-medium text-primary-300">공공저작물</div>
          <div className="text-base font-bold leading-tight">
            권리유형 자동분류
          </div>
          <div className="text-base font-bold leading-tight">서비스</div>
        </Link>
      </div>

      {/* 메인 메뉴 */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)
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
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* 관리자 메뉴 */}
        <div className="mt-6 pt-4 border-t border-primary-700 px-3">
          <div className="px-3 mb-2 text-xs font-medium text-primary-400 uppercase tracking-wider">
            관리자
          </div>
          <ul className="space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
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
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* 하단 정보 */}
      <div className="p-4 border-t border-primary-700 text-xs text-primary-400">
        <div>한국문화정보원</div>
        <div>숭실대 · HMC</div>
      </div>
    </aside>
  )
}
