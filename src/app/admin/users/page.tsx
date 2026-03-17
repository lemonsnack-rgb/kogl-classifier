"use client"

import { useState } from "react"
import AppLayout from "@/components/layout/AppLayout"
import type { UserRole } from "@/types"

interface MockUser {
  id: string
  email: string
  name: string
  role: UserRole
  status: "active" | "inactive"
  created_at: string
}

const initialUsers: MockUser[] = [
  {
    id: "1",
    email: "admin@kcii.go.kr",
    name: "관리자",
    role: "admin",
    status: "active",
    created_at: "2026-01-15",
  },
  {
    id: "2",
    email: "user1@org.go.kr",
    name: "김담당",
    role: "user",
    status: "active",
    created_at: "2026-02-01",
  },
  {
    id: "3",
    email: "user2@museum.go.kr",
    name: "이연구",
    role: "user",
    status: "active",
    created_at: "2026-02-15",
  },
  {
    id: "4",
    email: "invited@example.com",
    name: "-",
    role: "user",
    status: "inactive",
    created_at: "2026-03-10",
  },
]

export default function AdminUsersPage() {
  const [users, setUsers] = useState<MockUser[]>(initialUsers)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("user")

  const handleInvite = () => {
    if (!inviteEmail) return
    const newUser: MockUser = {
      id: String(users.length + 1),
      email: inviteEmail,
      name: "-",
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

  const handleRoleChange = (userId: string, newRole: UserRole) => {
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
            onClick={() => setShowInviteModal(true)}
            className="px-4 py-2 bg-accent-600 text-white rounded-md text-sm font-medium hover:bg-accent-700 transition-colors"
          >
            + 회원 초대
          </button>
        </div>

        {/* 회원 테이블 */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
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
                      {user.status === "active" ? "활성" : "비활성"}
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
        </div>

        {/* 초대 모달 */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                회원 초대
              </h3>
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
                  className="px-4 py-2 bg-accent-600 text-white rounded-md text-sm font-medium hover:bg-accent-700"
                >
                  초대 메일 발송
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
