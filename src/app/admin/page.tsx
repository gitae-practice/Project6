import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL, type AdminDashboardStats } from "@/lib/admin";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminTabs } from "@/components/admin/AdminTabs";

// 관리자 전용 사용 통계 대시보드.
// 개별 유저의 이메일/이름 같은 개인정보는 다루지 않고(유저/세션 탭도 이메일을 마스킹해서 보여줌),
// DB의 admin_* 함수들이 집계·가공해서 돌려준 결과만 화면에 그린다 (RLS 우회는 그 함수들 안에서만 일어난다).
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== ADMIN_EMAIL) {
    redirect("/");
  }

  const { data, error } = await supabase.rpc("admin_dashboard_stats");

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-lg font-medium">통계를 불러오지 못했습니다.</p>
        <p className="text-sm text-muted">{error?.message ?? "알 수 없는 오류가 발생했습니다."}</p>
      </div>
    );
  }

  const stats = data as AdminDashboardStats;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* 관리자 계정은 면접 화면을 쓸 일이 없으므로 홈으로 돌아가는 링크는 두지 않는다 */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <h1 className="font-semibold">관리자 대시보드</h1>
        <div className="flex items-center gap-1">
          <LogoutButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 sm:px-6">
        <AdminTabs stats={stats} />
      </div>
    </div>
  );
}
