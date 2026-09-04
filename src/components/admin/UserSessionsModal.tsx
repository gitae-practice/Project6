"use client";

import { X } from "lucide-react";
import { formatAdminDate, type AdminSessionRow, type AdminUserRow } from "@/lib/admin";

interface UserSessionsModalProps {
  user: AdminUserRow | null;
  sessions: AdminSessionRow[];
  sessionsLoading: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
}

// 유저 한 명의 지난 면접 목록 — 항목을 클릭하면 SessionDetailModal이 그 위에 한 번 더 열린다.
export function UserSessionsModal({
  user,
  sessions,
  sessionsLoading,
  onClose,
  onSelectSession,
}: UserSessionsModalProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <p className="font-semibold">{user?.masked_email ?? "유저"}</p>
            <p className="text-xs text-muted">가입일 {user ? formatAdminDate(user.joined_at) : "-"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sessionsLoading && <p className="py-8 text-center text-sm text-muted">불러오는 중...</p>}
          {!sessionsLoading && sessions.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">아직 진행한 면접이 없습니다.</p>
          )}
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li key={s.session_id}>
                <button
                  type="button"
                  onClick={() => onSelectSession(s.session_id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:border-accent hover:bg-accent/10"
                >
                  <span className="truncate">{s.job_role || "직무 미입력"}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {formatAdminDate(s.created_at)}
                    {s.overall_score != null && <span>· {s.overall_score.toFixed(1)}점</span>}
                    {!s.is_completed && <span className="text-amber-400">진행 중</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
