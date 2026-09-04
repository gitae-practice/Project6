"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { AppLogoIcon } from "@/components/AppLogoIcon";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 실제로 행을 지우지 않고 deleted_at만 채우는 소프트 삭제 — 관리자 통계(일/주/월 증감)가
  // 삭제 시점과 무관하게 정확히 집계되려면 과거에 존재했던 세션 기록 자체는 남아있어야 한다.
  // RLS(update_own_sessions)가 본인 세션만 수정 가능하게 막아준다.
  async function handleDelete(id: string, href: string) {
    if (!window.confirm("이 면접 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) return;

    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("interview_sessions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    setDeletingId(null);

    if (error) {
      window.alert(`삭제에 실패했습니다: ${error.message}`);
      return;
    }
    if (pathname === href) router.push("/"); // 보고 있던 기록이 삭제됐으면 홈으로 이동
    router.refresh(); // 서버 컴포넌트(layout.tsx)가 목록을 다시 조회하도록
  }

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
              <li key={item.id} className="flex items-center gap-1">
                <Link
                  href={href}
                  onClick={onClose}
                  className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-2 py-2 text-sm transition-colors ${
                    active ? "bg-accent/10 text-accent" : "hover:bg-border"
                  }`}
                >
                  <span className="truncate font-medium">{item.jobRole || "직무 미입력"}</span>
                  <span className={`text-xs ${active ? "text-accent/80" : "text-muted"}`}>
                    {date}
                    {item.overallScore != null && ` · ${item.overallScore.toFixed(1)}점`}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleDelete(item.id, href)}
                  disabled={deletingId === item.id}
                  aria-label="기록 삭제"
                  title="기록 삭제"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
