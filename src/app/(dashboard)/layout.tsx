import { AuthForm } from "@/components/AuthForm";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HistorySidebar, type HistorySidebarItem } from "@/components/HistorySidebar";
import { createClient } from "@/lib/supabase/server";

// interview_reports는 session_id가 unique라 1:1 관계지만, PostgREST 임베드는
// 상황에 따라 배열 또는 단일 객체로 내려줄 수 있어 둘 다 방어적으로 처리한다.
function firstReport<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 화면은 좌/우 2열 브랜딩 레이아웃을 자체적으로 그리므로 공용 헤더/사이드바 없이 그대로 노출한다.
  if (!user) {
    return <AuthForm />;
  }

  // 완료된(리포트가 있는) 지난 세션만 사이드바에 보여준다.
  const { data: sessions } = await supabase
    .from("interview_sessions")
    .select("id, job_role, created_at, interview_reports(overall_score)")
    .order("created_at", { ascending: false });

  const sidebarItems: HistorySidebarItem[] = (sessions ?? [])
    .map((session) => {
      const report = firstReport(session.interview_reports);
      if (!report) return null;
      return {
        id: session.id as string,
        jobRole: session.job_role as string | null,
        createdAt: session.created_at as string,
        overallScore: report.overall_score as number,
      };
    })
    .filter((item): item is HistorySidebarItem => item !== null);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <HistorySidebar items={sidebarItems} />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* 로고는 사이드바에 이미 있으므로 헤더는 우측 아이콘 버튼만 담는 얇은 바로 둔다 */}
          <header className="flex items-center justify-end gap-1 border-b border-border px-4 py-2">
            <LogoutButton />
            <ThemeToggle />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
