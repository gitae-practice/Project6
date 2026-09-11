import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MyPageForm } from "@/components/MyPageForm";

// 로그인 여부 자체는 (dashboard)/layout.tsx가 이미 보장하고, 관리자 계정도 거기서
// /admin으로 리다이렉트되지만, user.email 접근 전에 한 번 더 방어적으로 확인한다.
export default async function MyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/");
  }

  const initialName = (user.user_metadata?.full_name as string | undefined)?.trim() ?? "";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <MyPageForm email={user.email} initialName={initialName} />
    </div>
  );
}
