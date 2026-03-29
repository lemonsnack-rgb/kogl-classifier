"use client"

import { useState, useEffect, useCallback } from "react"
import AppLayout from "@/components/layout/AppLayout"
import { isSupabaseConfigured, createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/types"
import { Pencil, X, Save } from "lucide-react"

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

interface EditForm {
  name: string
  organization: string
  department: string
  role: UserRole
  newPassword: string
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
  const [editingUser, setEditingUser] = useState<UserItem | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    organization: "",
    department: "",
    role: "user",
    newPassword: "",
  })
  const [saving, setSaving] = useState(false)

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

  const openEditModal = (user: UserItem) => {
    setEditingUser(user)
    setEditForm({
      name: user.name === "-" ? "" : user.name,
      organization: user.organization === "-" ? "" : user.organization,
      department: user.department === "-" ? "" : user.department,
      role: user.role,
      newPassword: "",
    })
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setEditForm({ name: "", organization: "", department: "", role: "user", newPassword: "" })
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return
    setSaving(true)

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient()

        // 프로필 정보 업데이트
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            name: editForm.name || null,
            organization: editForm.organization || null,
            department: editForm.department || null,
            role: editForm.role,
          })
          .eq("id", editingUser.id)

        if (profileError) {
          alert("회원정보 수정 중 오류가 발생했습니다: " + profileError.message)
          setSaving(false)
          return
        }

        // 비밀번호 변경 (입력된 경우에만)
        if (editForm.newPassword.trim()) {
          if (editForm.newPassword.length < 6) {
            alert("비밀번호는 6자 이상이어야 합니다.")
            setSaving(false)
            return
          }

          // Supabase Admin API로 비밀번호 변경 (service_role 필요)
          // 클라이언트에서는 직접 변경 불가하므로 API Route를 통해 처리
          const res = await fetch("/api/admin/update-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: editingUser.id,
              newPassword: editForm.newPassword,
            }),
          })

          if (!res.ok) {
            const data = await res.json().catch(() => null)
            alert("비밀번호 변경 실패: " + (data?.error || "서버 오류"))
            setSaving(false)
            return
          }
        }
      } catch {
        alert("회원정보 수정 중 오류가 발생했습니다.")
        setSaving(false)
        return
      }
    }

    // UI 업데이트
    setUsers(
      users.map((u) =>
        u.id === editingUser.id
          ? {
              ...u,
              name: editForm.name || "-",
              organization: editForm.organization || "-",
              department: editForm.department || "-",
              role: editForm.role,
            }
          : u
      )
    )

    setSaving(false)
    closeEditModal()
    alert("회원정보가 수정되었습니다." + (editForm.newPassword.trim() ? " 비밀번호도 변경되었습니다." : ""))
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
                    부서
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
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {user.department}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                          user.role === "admin"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {user.role === "admin" ? "관리자" : "일반"}
                      </span>
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          <Pencil className="w-3 h-3" />
                          편집
                        </button>
                        {!user.approved && (
                          <>
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
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 회원정보 편집 모달 */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">회원정보 편집</h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* 이메일 (읽기 전용) */}
              <div>
                <label className="text-sm text-gray-500 block mb-1">이메일</label>
                <p className="text-sm text-gray-900 font-medium bg-gray-50 px-3 py-2 rounded-md">
                  {editingUser.email}
                </p>
              </div>

              {/* 이름 */}
              <div>
                <label className="text-sm text-gray-500 block mb-1">이름</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="이름"
                />
              </div>

              {/* 소속기관 */}
              <div>
                <label className="text-sm text-gray-500 block mb-1">소속기관</label>
                <input
                  type="text"
                  value={editForm.organization}
                  onChange={(e) => setEditForm({ ...editForm, organization: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="소속기관"
                />
              </div>

              {/* 부서 */}
              <div>
                <label className="text-sm text-gray-500 block mb-1">부서</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="부서"
                />
              </div>

              {/* 역할 */}
              <div>
                <label className="text-sm text-gray-500 block mb-1">역할</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="user">일반</option>
                  <option value="admin">관리자</option>
                </select>
              </div>

              {/* 비밀번호 변경 */}
              <div>
                <label className="text-sm text-gray-500 block mb-1">
                  비밀번호 변경 <span className="text-gray-400">(변경 시에만 입력)</span>
                </label>
                <input
                  type="password"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="새 비밀번호 (6자 이상)"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={closeEditModal}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
