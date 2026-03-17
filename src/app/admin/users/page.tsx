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
  role: UserRole
  status: "active" | "inactive"
  created_at: string
}

const initialMockUsers: UserItem[] = [
  {
    id: "1",
    email: "admin@kcii.go.kr",
    name: "관리자",
    organization: "한국문화정보원",
    role: "admin",
    status: "active",
    created_at: "2026-01-15",
  },
  {
    id: "2",
    email: "user1@org.go.kr",
    name: "김담당",
    organization: "한국문화정보원",
    role: "user",
    status: "active",
    created_at: "2026-02-01",
  },
  {
    id: "3",
    email: "user2@museum.go.kr",
    name: "이연구",
    organization: "국립박물관",
    role: "user",
    status: "active",
    created_at: "2026-02-15",
  },
  {
    id: "4",
    email: "invited@example.com",
    name: "-",
    organization: "-",
    role: "user",
    status: "inactive",
    created_at: "2026-03-10",
  },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("user")
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, email, name, organization, role, created_at")
          .order("created_at", { ascending: true })

        if (error) {
          console.error("Failed to fetch profiles:", error)
          setLoading(false)
          return
        }

        // profiles에서 invitations 상태도 확인
        const { data: invitations } = await supabase
          .from("invitations")
          .select("email, status, role, created_at")
          .eq("status", "pending")

        const profileUsers: UserItem[] = (profiles || []).map((p) => ({
          id: p.id,
          email: p.email || "",
          name: p.name || "-",
          organization: p.organization || "-",
          role: p.role as UserRole,
          status: "active" as const,
          created_at: p.created_at
            ? p.created_at.split("T")[0]
            : "",
        }))

        // 아직 수락하지 않은 초대 건도 표시
        const pendingInvites: UserItem[] = (invitations || [])
          .filter(
            (inv) =>
              !profileUsers.some((u) => u.email === inv.email)
          )
          .map((inv, idx) => ({
            id: `inv-${idx}`,
            email: inv.email,
            name: "-",
            organization: "-",
            role: inv.role as UserRole,
            status: "inactive" as const,
            created_at: inv.created_at
              ? inv.created_at.split("T")[0]
              : "",
          }))

        setUsers([...profileUsers, ...pendingInvites])
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

  const handleInvite = async () => {
    if (!inviteEmail) return
    setInviteLoading(true)
    setInviteError("")

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()

        // Magic Link 발송 (signInWithOtp로 초대 메일 발송)
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: inviteEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })

        if (otpError) {
          setInviteError(otpError.message)
          setInviteLoading(false)
          return
        }

        // invitations 테이블에 기록
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser()

        if (currentUser) {
          await supabase.from("invitations").insert({
            email: inviteEmail,
            invited_by: currentUser.id,
            role: inviteRole,
            status: "pending",
          })
        }

        // UI에 추가
        const newUser: UserItem = {
          id: `inv-${Date.now()}`,
          email: inviteEmail,
          name: "-",
          organization: "-",
          role: inviteRole,
          status: "inactive",
          created_at: new Date().toISOString().split("T")[0],
        }
        setUsers((prev) => [...prev, newUser])
        setInviteEmail("")
        setInviteRole("user")
        setShowInviteModal(false)
        alert(`${inviteEmail}으로 초대 메일이 발송되었습니다.`)
      } catch {
        setInviteError("초대 메일 발송 중 오류가 발생했습니다.")
      }
    } else {
      // Mock 모드
      const newUser: UserItem = {
        id: String(users.length + 1),
        email: inviteEmail,
        name: "-",
        organization: "-",
        role: inviteRole,
        status: "inactive",
        created_at: new Date().toISOString().split("T")[0],
      }
      setUsers([...users, newUser])
      setInviteEmail("")
      setInviteRole("user")
      setShowInviteModal(false)
      alert(`${inviteEmail}으로 초대 메일이 발송되었습니다.`)
    }

    setInviteLoading(false)
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (isSupabaseConfigured() && !userId.startsWith("inv-")) {
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

  const handleToggleStatus = (userId: string) => {
    setUsers(
      users.map((u) =>
        u.id === userId
          ? { ...u, status: u.status === "active" ? "inactive" : "active" }
          : u
      )
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">회원관리</h2>
          <button
            onClick={() => {
              setShowInviteModal(true)
              setInviteError("")
            }}
            className="px-4 py-2 bg-accent-600 text-white rounded-md text-sm font-medium hover:bg-accent-700 transition-colors"
          >
            + 회원 초대
          </button>
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
                    역할
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    상태
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
                          user.status === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            user.status === "active"
                              ? "bg-green-500"
                              : "bg-gray-400"
                          }`}
                        />
                        {user.status === "active" ? "활성" : "대기"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.created_at}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        className={`text-xs font-medium ${
                          user.status === "active"
                            ? "text-red-600 hover:text-red-700"
                            : "text-green-600 hover:text-green-700"
                        }`}
                      >
                        {user.status === "active" ? "비활성화" : "활성화"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 초대 모달 */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                회원 초대
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                입력한 이메일로 로그인 링크가 발송됩니다.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="초대할 이메일 주소"
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    역할
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as UserRole)
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="user">사용자 (user)</option>
                    <option value="admin">관리자 (admin)</option>
                  </select>
                </div>
                {inviteError && (
                  <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                    {inviteError}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-gray-200 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-accent-600 text-white rounded-md text-sm font-medium hover:bg-accent-700 disabled:opacity-50"
                >
                  {inviteLoading ? "발송 중..." : "초대 메일 발송"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
