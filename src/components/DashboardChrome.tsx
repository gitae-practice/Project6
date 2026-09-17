"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, UserCog } from "lucide-react";
import { HistorySidebar, type HistorySidebarItem, type InProgressSidebarItem } from "@/components/HistorySidebar";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

// 마이페이지 링크 — 모바일/데스크톱 헤더 양쪽에서 똑같이 쓰므로 따로 뺐다.
function MyPageLink() {
  return (
    <Link
      href="/mypage"
      aria-label="마이페이지"
      title="마이페이지"
      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
    >
      <UserCog className="h-5 w-5" />
    </Link>
  );
}

// 로그인 후 화면 전체를 감싸는 클라이언트 껍데기.
// 사이드바를 "모바일에서는 드로어, md 이상에서는 항상 노출"로 동작시키려면
// 헤더의 햄버거 버튼과 사이드바가 열림 상태를 공유해야 해서 하나의 클라이언트 컴포넌트로 묶었다.
// (layout.tsx는 서버 컴포넌트라 상태를 들고 있을 수 없다)
export function DashboardChrome({
  items,
  inProgressItems,
  children,
}: {
  items: HistorySidebarItem[];
  inProgressItems: InProgressSidebarItem[];
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // "새 면접 시작"을 눌렀을 때, 이미 "/"에 있으면(면접 진행 중이어도) Link가 같은 경로라 아무
  // 네비게이션도 안 일어나서 InterviewChat의 내부 상태(진행 중이던 면접)가 그대로 남는 버그가
  // 있었다. 이 값을 바꿔서 children을 강제로 다시 마운트시켜 우회한다.
  const [resetKey, setResetKey] = useState(0);

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      {/* 모바일 전용 상단 바 — 햄버거 메뉴 + 마이페이지/로그아웃/테마 토글 */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="메뉴 열기"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1">
          <MyPageLink />
          <LogoutButton />
          <ThemeToggle />
        </div>
      </header>

      {/* 드로어가 열려 있을 때 뒤 배경을 어둡게 덮는 오버레이 — 클릭하면 닫힘 */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      )}

      <HistorySidebar
        items={items}
        inProgressItems={inProgressItems}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewInterview={() => setResetKey((k) => k + 1)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 데스크톱 전용 헤더 — 로고는 사이드바에 이미 있으므로 우측 아이콘 버튼만 담는다 */}
        <header className="hidden items-center justify-end gap-1 border-b border-border px-4 py-2 md:flex">
          <MyPageLink />
          <LogoutButton />
          <ThemeToggle />
        </header>
        <div key={resetKey} className="contents">
          {children}
        </div>
      </div>
    </div>
  );
}
