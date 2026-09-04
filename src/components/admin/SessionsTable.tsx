"use client";

import { useMemo, useState } from "react";
import { formatAdminDate, type AdminSessionRow } from "@/lib/admin";

type CompletionFilter = "all" | "completed" | "in_progress";

const COMPLETION_FILTERS: { key: CompletionFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "completed", label: "완료" },
  { key: "in_progress", label: "미완료" },
];

interface SessionsTableProps {
  sessions: AdminSessionRow[] | null;
  isLoading: boolean;
  error: string | null;
  onSelectSession: (sessionId: string) => void;
}

// 전체 면접 세션 목록 — 완료/미완료 토글과 날짜 범위는 이미 받아온 목록 안에서
// 클라이언트 쪽에서 필터링한다 (규모상 서버 왕복 없이 처리해도 충분).
export function SessionsTable({ sessions, isLoading, error, onSelectSession }: SessionsTableProps) {
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((s) => {
      if (completionFilter === "completed" && !s.is_completed) return false;
      if (completionFilter === "in_progress" && s.is_completed) return false;
      const createdDate = s.created_at.slice(0, 10); // YYYY-MM-DD
      if (fromDate && createdDate < fromDate) return false;
      if (toDate && createdDate > toDate) return false;
      return true;
    });
  }, [sessions, completionFilter, fromDate, toDate]);

  if (isLoading) return <p className="py-8 text-center text-sm text-muted">불러오는 중...</p>;
  if (error) return <p className="py-8 text-center text-sm text-red-500">{error}</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          {COMPLETION_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCompletionFilter(key)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                completionFilter === key ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-lg border border-border bg-white/6 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        <span className="text-xs text-muted">~</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border border-border bg-white/6 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">조건에 맞는 세션이 없습니다.</p>
      ) : (
        <div className="glass-card overflow-x-auto rounded-xl">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-4 py-3 font-medium">유저</th>
                <th className="px-4 py-3 font-medium">지원 직무</th>
                <th className="px-4 py-3 font-medium">면접 날짜</th>
                <th className="px-4 py-3 font-medium">종합 점수</th>
                <th className="px-4 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.session_id}
                  onClick={() => onSelectSession(s.session_id)}
                  className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-border/40"
                >
                  <td className="px-4 py-3 font-medium">{s.masked_email}</td>
                  <td className="px-4 py-3">{s.job_role || "직무 미입력"}</td>
                  <td className="px-4 py-3 text-muted">{formatAdminDate(s.created_at)}</td>
                  <td className="px-4 py-3">{s.overall_score != null ? s.overall_score.toFixed(1) : "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        s.is_completed ? "bg-green-400/10 text-green-400" : "bg-amber-400/10 text-amber-400"
                      }`}
                    >
                      {s.is_completed ? "완료" : "진행 중"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
