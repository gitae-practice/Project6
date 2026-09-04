import type { InterviewReport } from "@/lib/interview/report";
import type { HistoryByRole } from "@/lib/interview/transcript";

// 관리자 계정 식별 — 이 이메일과 일치해야 /admin 접근이 허용된다.
// 실제 권한 검사(DB 함수들)는 서버 쪽 Postgres 함수 안에서 한 번 더 확인하므로,
// 여기 값을 바꿔치기해도 DB 쪽 값(schema.sql)까지 같이 바꿔야 실제로 통과된다.
export const ADMIN_EMAIL = "admin@admin.com";

// 아래 타입들은 supabase.rpc(...)로 호출하는 admin_* DB 함수들의 반환 모양과 1:1로 맞춘다.
// (schema.sql 참고 — 개별 유저 이메일은 DB 함수 안에서 이미 마스킹된 채로 내려온다)

export interface AdminDashboardStats {
  total_users: number;
  total_sessions: number;
  completed_interviews: number;
  average_score: number | null;
  in_progress_sessions: number;
  new_users_today: number;
  top_job_roles: { job_role: string; count: number }[];
  sessions_last_7_days: { date: string; count: number }[];
  score_distribution: { range: string; count: number }[];
}

export interface AdminUserRow {
  user_id: string;
  masked_email: string;
  joined_at: string;
  total_sessions: number;
  last_session_at: string | null;
  average_score: number | null;
}

export interface AdminSessionRow {
  session_id: string;
  user_id: string;
  masked_email: string;
  job_role: string | null;
  created_at: string;
  overall_score: number | null;
  is_completed: boolean;
}

export interface AdminSessionDetail {
  session_id: string;
  masked_email: string;
  job_role: string | null;
  created_at: string;
  report: InterviewReport | null; // 아직 진행 중(리포트 미생성)이면 null
  history: HistoryByRole;
}

// 관리자 화면 여러 곳(유저/세션 테이블, 상세 모달)에서 날짜 표시 형식을 통일한다.
export function formatAdminDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}
