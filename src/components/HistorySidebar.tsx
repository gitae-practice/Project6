"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X } from "lucide-react";
import { AppLogoIcon } from "@/components/AppLogoIcon";

// 사이드바에는 리포트가 이미 생성된(=완료된) 세션만 넣으므로 overallScore는 항상 존재한다.
export interface HistorySidebarItem {
  id: string;
  jobRole: string | null;
  createdAt: string;
  overallScore: number;
}

interface HistorySidebarProps {
  items: HistorySidebarItem[];
  // 모바일 드로어 상태 — md 이상에서는 사용하지 않고 항상 노출된다.
  isOpen: boolean;
  onClose: () => void;
}

// 좌측 사이드바 — 로그인 후 화면 왼쪽에 항상 떠 있는 지난 면접 기록 목록.
// 목록 데이터는 서버 컴포넌트(layout.tsx)에서 미리 조회해 props로 내려받는다.
// 모바일(md 미만)에서는 fixed 드로어로 동작하고, md 이상에서는 항상 고정 노출되는 사이드바가 된다.
export function HistorySidebar({ items, isOpen, onClose }: HistorySidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-surface transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-4">
        <div className="flex items-center gap-2">
          <AppLogoIcon />
          <span className="font-semibold tracking-tight">오늘의 면접관</span>
        </div>
        {/* 닫기 버튼은 모바일 드로어에서만 필요 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="메뉴 닫기"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/"
          onClick={onClose}
          className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/"
              ? "border-accent bg-accent/10 text-accent"
              : "border-accent/40 text-accent hover:bg-accent/10"
          }`}
        >
          <Plus className="h-4 w-4" /> 새 면접 시작
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 pb-1 text-xs font-medium text-muted">지난 기록</p>

        {items.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted">아직 완료한 면접이 없습니다.</p>
        )}

        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const href = `/history/${item.id}`;
            const active = pathname === href;
            const date = new Date(item.createdAt).toLocaleDateString("ko-KR", {
              month: "short",
              day: "numeric",
            });
            return (
              <li key={item.id}>
                <Link
                  href={href}
                  onClick={onClose}
                  className={`flex flex-col gap-0.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                    active ? "bg-accent/10 text-accent" : "hover:bg-border"
                  }`}
                >
                  <span className="truncate font-medium">{item.jobRole || "직무 미입력"}</span>
                  <span className={`text-xs ${active ? "text-accent/80" : "text-muted"}`}>
                    {date}
                    {item.overallScore != null && ` · ${item.overallScore.toFixed(1)}점`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
