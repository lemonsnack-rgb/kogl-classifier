"use client"

import { useState, useEffect, useCallback } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types"

interface UserItem {
  id: string
  email: string
  name: string
  organization: string
  department: string
  role: UserRole
  approved: boolean
  created_at: string
}

const initialMockUsers: UserItem[] = [
  {
    id: "1",
    email: "admin@kcii.go.kr",
    name: "관리자",
    organization: "한국문화정보원",
    department: "저작권관리팀",
    role: "admin",
    approved: true,
    created_at: "2026-01-15",
  },
  {
    id: "2",
    email: "user1@org.go.kr",
    name: "김담당",
    organization: "한국문화정보원",
    department: "정보화팀",
    role: "user",
    approved: true,
    created_at: "2026-02-01",
  },
  {
    id: "3",
    email: "user2@museum.go.kr",
    name: "이연구",
    organization: "국립박물관",
    department: "",
    role: "user",
    approved: true,
    created_at: "2026-02-15",
  },
  {
    id: "4",
    email: "pending@example.com",
    name: "박대기",
    organization: "테스트기관",
    department: "",
    role: "user",
    approved: false,
    created_at: "2026-03-10",
  },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, email, name, organization, department, role, approved, created_at")
          .order("created_at", { ascending: true })

        if (error) {
          console.error("Failed to fetch profiles:", error)
          setLoading(false)
          return
        }

        const profileUsers: UserItem[] = (profiles || []).map((p) => ({
          id: p.id,
          email: p.email || "",
          name: p.name || "-",
          organization: p.organization || "-",
          department: p.department || "-",
          role: p.role as UserRole,
          approved: p.approved ?? false,
          created_at: p.created_at
            ? p.created_at.split("T")[0]
            : "",
        }))

        setUsers(profileUsers)
      } catch (err) {
        console.error("Failed to fetch users:", err)
      }
    } else {
      setUsers(initialMockUsers)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleApprove = async (userId: string) => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from("profiles")
          .update({ approved: true })
          .eq("id", userId)

        if (error) {
          alert("승인 처리 중 오류가 발생했습니다.")
          console.error("Approve error:", error)
          return
        }
      } catch {
        alert("승인 처리 중 오류가 발생했습니다.")
        return
      }
    }
    setUsers(
      users.map((u) => (u.id === userId ? { ...u, approved: true } : u))
    )
  }

  const handleReject = async (userId: string) => {
    if (!confirm("이 사용자의 가입을 거절하시겠습니까? 계정이 삭제됩니다.")) {
      return
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        // profiles 삭제 (auth.users는 service_role 필요하므로 profiles만 삭제)
        const { error } = await supabase
          .from("profiles")
          .delete()
          .eq("id", userId)

        if (error) {
          alert("거절 처리 중 오류가 발생했습니다.")
          console.error("Reject error:", error)
          return
        }
      } catch {
        alert("거절 처리 중 오류가 발생했습니다.")
        return
      }
    }
    setUsers(users.filter((u) => u.id !== userId))
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        await supabase
          .from("profiles")
          .update({ role: newRole })
          .eq("id", userId)
      } catch {
        alert("역할 변경 중 오류가 발생했습니다.")
        return
      }
    }
    setUsers(
      users.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    )
  }

  return (
    <AppLayout>
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">회원관리</h2>
        </div>

        {/* 회원 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              로딩 중...
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    이메일
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    이름
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    소속기관
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    역할
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    승인상태
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    가입일
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {user.organization}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user.id, e.target.value as UserRole)
                        }
                        className="text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          user.approved
                            ? "bg-green-50 text-green-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.approved
                              ? "bg-green-500"
                              : "bg-yellow-500"
                          }`}
                        />
                        {user.approved ? "승인됨" : "승인 대기"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.created_at}
                    </td>
                    <td className="px-4 py-3">
                      {!user.approved ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="text-xs font-medium text-green-600 hover:text-green-700"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => handleReject(user.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
