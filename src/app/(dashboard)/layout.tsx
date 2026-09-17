import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { DashboardChrome } from "@/components/DashboardChrome";
import { type HistorySidebarItem, type InProgressSidebarItem } from "@/components/HistorySidebar";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/admin";

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

  // 관리자 계정은 면접을 볼 일이 없으므로 이 레이아웃 아래 어떤 경로로 들어와도
  // 항상 관리자 대시보드로 보낸다 (직접 주소를 쳐서 들어오는 경우까지 포함).
  if (user.email === ADMIN_EMAIL) {
    redirect("/admin");
  }

  // 유저가 소프트 삭제한 세션은 deleted_at이 채워져 있을 뿐 DB에는 남아있으므로(관리자 통계용)
  // 여기서 명시적으로 제외한다. 리포트가 있으면 완료된 지난 기록, 없으면 아직 진행 중인
  // 면접(어딘가에서 "새 면접 시작"으로 끊겼거나 브라우저를 닫고 나간 경우)으로 나눠서 보여준다.
  const { data: sessions } = await supabase
    .from("interview_sessions")
    .select("id, job_role, created_at, interview_reports(overall_score)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const sidebarItems: HistorySidebarItem[] = [];
  const inProgressItems: InProgressSidebarItem[] = [];

  for (const session of sessions ?? []) {
    const report = firstReport(session.interview_reports);
    if (report) {
      sidebarItems.push({
        id: session.id as string,
        jobRole: session.job_role as string | null,
        createdAt: session.created_at as string,
        overallScore: report.overall_score as number,
      });
    } else {
      inProgressItems.push({
        id: session.id as string,
        jobRole: session.job_role as string | null,
        createdAt: session.created_at as string,
      });
    }
  }

  return (
    <DashboardChrome items={sidebarItems} inProgressItems={inProgressItems}>
      {children}
    </DashboardChrome>
  );
}
