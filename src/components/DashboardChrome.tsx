"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { HistorySidebar, type HistorySidebarItem } from "@/components/HistorySidebar";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

// 로그인 후 화면 전체를 감싸는 클라이언트 껍데기.
// 사이드바를 "모바일에서는 드로어, md 이상에서는 항상 노출"로 동작시키려면
// 헤더의 햄버거 버튼과 사이드바가 열림 상태를 공유해야 해서 하나의 클라이언트 컴포넌트로 묶었다.
// (layout.tsx는 서버 컴포넌트라 상태를 들고 있을 수 없다)
export function DashboardChrome({
  items,
  children,
}: {
  items: HistorySidebarItem[];
  children: ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col bg-background md:flex-row">
      {/* 모바일 전용 상단 바 — 햄버거 메뉴 + 로그아웃/테마 토글 */}
      <header className="flex items-center justify-between border-b border-border px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="메뉴 열기"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1">
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

      <HistorySidebar items={items} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 데스크톱 전용 헤더 — 로고는 사이드바에 이미 있으므로 우측 아이콘 버튼만 담는다 */}
        <header className="hidden items-center justify-end gap-1 border-b border-border px-4 py-2 md:flex">
          <LogoutButton />
          <ThemeToggle />
        </header>
        {children}
      </div>
    </div>
  );
}
