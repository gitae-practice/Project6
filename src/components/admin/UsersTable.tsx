"use client";

import { formatAdminDate, type AdminUserRow } from "@/lib/admin";

interface UsersTableProps {
  users: AdminUserRow[] | null;
  isLoading: boolean;
  error: string | null;
  onSelectUser: (userId: string) => void;
}

// 유저 목록 — 이메일은 서버(admin_list_users 함수)에서 이미 마스킹된 채로 내려온다.
// 행을 클릭하면 그 유저의 면접 기록 모달이 열린다 (AdminTabs가 상태를 들고 있음).
export function UsersTable({ users, isLoading, error, onSelectUser }: UsersTableProps) {
  if (isLoading) return <p className="py-8 text-center text-sm text-muted">불러오는 중...</p>;
  if (error) return <p className="py-8 text-center text-sm text-red-500">{error}</p>;
  if (!users || users.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">가입한 유저가 없습니다.</p>;
  }

  return (
    <div className="glass-card overflow-x-auto rounded-xl">
      <table className="w-full whitespace-nowrap text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted">
            <th className="px-4 py-3 font-medium">이메일</th>
            <th className="px-4 py-3 font-medium">가입일</th>
            <th className="px-4 py-3 font-medium">총 면접 횟수</th>
            <th className="px-4 py-3 font-medium">마지막 면접</th>
            <th className="px-4 py-3 font-medium">평균 점수</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr
              key={u.user_id}
              onClick={() => onSelectUser(u.user_id)}
              className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-border/40"
            >
              <td className="px-4 py-3 font-medium">{u.masked_email}</td>
              <td className="px-4 py-3 text-muted">{formatAdminDate(u.joined_at)}</td>
              <td className="px-4 py-3">{u.total_sessions}</td>
              <td className="px-4 py-3 text-muted">{u.last_session_at ? formatAdminDate(u.last_session_at) : "-"}</td>
              <td className="px-4 py-3">{u.average_score != null ? u.average_score.toFixed(1) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
