"use client";

import { useRouter } from "next/navigation";
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
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
    >
      로그아웃
    </button>
  );
}
