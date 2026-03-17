"use client"

import { useState, useEffect } from "react"

export default function Header() {
  const [displayName, setDisplayName] = useState("사용자")

  useEffect(() => {
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
  }, [])

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h1 className="text-base font-semibold text-gray-900">
        공공저작물 권리유형 자동분류 서비스
      </h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">{displayName}</span>
      </div>
    </header>
  )
}
