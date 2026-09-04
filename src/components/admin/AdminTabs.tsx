"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AdminDashboardStats, AdminSessionRow, AdminUserRow } from "@/lib/admin";
import { OverviewSection } from "@/components/admin/OverviewSection";
import { UsersTable } from "@/components/admin/UsersTable";
import { SessionsTable } from "@/components/admin/SessionsTable";
import { UserSessionsModal } from "@/components/admin/UserSessionsModal";
import { SessionDetailModal } from "@/components/admin/SessionDetailModal";

const TABS = [
  { key: "overview", label: "개요" },
  { key: "users", label: "유저 관리" },
  { key: "sessions", label: "세션 관리" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// 관리자 대시보드 본문 — 탭 전환 + 유저/세션 목록의 지연 로딩(처음 탭을 열 때만 불러오고,
// 그 뒤로는 캐시해서 재사용) + 유저/세션 상세 모달의 열림 상태까지 한 곳에서 관리한다.
export function AdminTabs({ stats }: { stats: AdminDashboardStats }) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<AdminSessionRow[] | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  async function ensureUsersLoaded() {
    if (users !== null || usersLoading) return;
    setUsersLoading(true);
    setUsersError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_list_users");
    if (error) setUsersError(error.message);
    else setUsers((data ?? []) as AdminUserRow[]);
    setUsersLoading(false);
  }

  async function ensureSessionsLoaded() {
    if (sessions !== null || sessionsLoading) return;
    setSessionsLoading(true);
    setSessionsError(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_list_sessions");
    if (error) setSessionsError(error.message);
    else setSessions((data ?? []) as AdminSessionRow[]);
    setSessionsLoading(false);
  }

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    if (tab === "users") void ensureUsersLoaded();
    if (tab === "sessions") void ensureSessionsLoaded();
  }

  function handleSelectUser(userId: string) {
    void ensureSessionsLoaded(); // 유저 모달도 세션 목록이 필요하므로 아직 안 불러왔으면 같이 불러온다
    setSelectedUserId(userId);
  }

  const selectedUser = users?.find((u) => u.user_id === selectedUserId) ?? null;
  const selectedUserSessions = (sessions ?? []).filter((s) => s.user_id === selectedUserId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleTabChange(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewSection stats={stats} />}
      {activeTab === "users" && (
        <UsersTable users={users} isLoading={usersLoading} error={usersError} onSelectUser={handleSelectUser} />
      )}
      {activeTab === "sessions" && (
        <SessionsTable
          sessions={sessions}
          isLoading={sessionsLoading}
          error={sessionsError}
          onSelectSession={setSelectedSessionId}
        />
      )}

      {selectedUserId && (
        <UserSessionsModal
          user={selectedUser}
          sessions={selectedUserSessions}
          sessionsLoading={sessionsLoading}
          onClose={() => setSelectedUserId(null)}
          onSelectSession={setSelectedSessionId}
        />
      )}
      {selectedSessionId && (
        // key를 줘서 다른 세션을 연달아 열 때마다 컴포넌트를 새로 마운트시킨다 — 그래야 내부에서
        // "sessionId가 바뀌면 로딩 상태를 초기화"하는 로직을 effect 안에 따로 둘 필요가 없어진다.
        <SessionDetailModal key={selectedSessionId} sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
      )}
    </div>
  );
}
