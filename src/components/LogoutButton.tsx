"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh(); // 서버 컴포넌트(page.tsx)가 로그인 상태를 다시 읽도록 새로고침
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      aria-label="로그아웃"
      title="로그아웃"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
