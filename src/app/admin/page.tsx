import { redirect } from "next/navigation";
import { Users, MessagesSquare, ClipboardCheck, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AdminDashboardStats {
  total_users: number;
  total_sessions: number;
  completed_interviews: number;
  average_score: number | null;
  top_job_roles: { job_role: string; count: number }[];
  sessions_last_7_days: { date: string; count: number }[];
}

// 관리자 전용 사용 통계 대시보드.
// 개별 유저의 이메일/이름 같은 개인정보는 다루지 않고, DB의 admin_dashboard_stats() 함수가
// 미리 집계해서 돌려준 숫자만 화면에 그린다 (RLS 우회는 그 함수 안에서만 일어난다).
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
  const maxJobRoleCount = Math.max(1, ...stats.top_job_roles.map((r) => r.count));
  const maxDailyCount = Math.max(1, ...stats.sessions_last_7_days.map((d) => d.count));

  const statCards = [
    { label: "총 가입자", value: stats.total_users, icon: Users, accent: "text-blue-400" },
    { label: "총 면접 세션", value: stats.total_sessions, icon: MessagesSquare, accent: "text-orange-400" },
    { label: "완료된 면접", value: stats.completed_interviews, icon: ClipboardCheck, accent: "text-green-400" },
    {
      label: "평균 점수",
      value: stats.average_score != null ? stats.average_score.toFixed(1) : "-",
      icon: Star,
      accent: "text-amber-400",
    },
  ];

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

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {/* 요약 지표 4개 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="glass-card flex flex-col gap-2 rounded-xl p-4">
              <Icon className={`h-4 w-4 ${accent}`} />
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 인기 지원 직무 TOP 5 */}
          <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
            <p className="text-sm font-medium text-muted">인기 지원 직무 TOP 5</p>
            {stats.top_job_roles.length === 0 ? (
              <p className="text-xs text-muted">아직 데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {stats.top_job_roles.map((row) => (
                  <div key={row.job_role} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{row.job_role}</span>
                      <span className="text-muted">{row.count}건</span>
                    </div>
                    <div className="h-2 rounded-full bg-border">
                      <div
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${(row.count / maxJobRoleCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 최근 7일 면접 시작 추이 */}
          <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
            <p className="text-sm font-medium text-muted">최근 7일 면접 시작 추이</p>
            <div className="flex h-32 items-end justify-between gap-2">
              {stats.sessions_last_7_days.map((day) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xs text-muted">{day.count}</span>
                  <div
                    className="w-full rounded-t-md bg-accent"
                    style={{ height: `${(day.count / maxDailyCount) * 100}%`, minHeight: day.count > 0 ? "4px" : "1px" }}
                  />
                  <span className="text-[10px] text-muted">{day.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
