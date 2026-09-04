import type { InterviewReport } from "@/lib/interview/report";
import type { HistoryByRole } from "@/lib/interview/transcript";

// 관리자 계정 식별 — 이 이메일과 일치해야 /admin 접근이 허용된다.
// 실제 권한 검사(DB 함수들)는 서버 쪽 Postgres 함수 안에서 한 번 더 확인하므로,
// 여기 값을 바꿔치기해도 DB 쪽 값(schema.sql)까지 같이 바꿔야 실제로 통과된다.
export const ADMIN_EMAIL = "admin@admin.com";

// 아래 타입들은 supabase.rpc(...)로 호출하는 admin_* DB 함수들의 반환 모양과 1:1로 맞춘다.
// (schema.sql 참고 — 개별 유저 이메일은 DB 함수 안에서 이미 마스킹된 채로 내려온다)

// 스탯 카드 하나의 값 — "지금 값"과 "1일/7일/1개월 전 시점 기준 값"을 같이 받아서
// 프론트의 일/주/월 토글에 따라 증감률을 계산한다 (비교 대상 값 자체는 DB 함수가 이미 같은 기준으로 계산해둠).
export interface AdminStatWithTrend {
  value: number | null;
  day: number | null;
  week: number | null;
  month: number | null;
}

// 개요 탭 상단의 "일 / 주 / 월" 토글이 고르는 비교 기준.
export type TrendPeriod = "day" | "week" | "month";

export interface AdminDashboardStats {
  total_users: AdminStatWithTrend;
  total_sessions: AdminStatWithTrend;
  completed_interviews: AdminStatWithTrend;
  average_score: AdminStatWithTrend;
  in_progress_sessions: AdminStatWithTrend;
  new_users_today: AdminStatWithTrend;
  top_job_roles: { job_role: string; count: number }[];
  sessions_last_7_days: { date: string; count: number }[];
  score_distribution: { range: string; count: number }[];
}

// 스탯 카드 하단의 증감 문구 + 화살표 방향을 선택된 기간(일/주/월) 기준으로 계산한다.
// 비교할 이전 값이 없거나(null) 이전 값이 0이면 퍼센트를 정의할 수 없고, 값이 있어도 변화가
// 0%로 반올림되면 의미 있는 증감이 아니므로 두 경우 다 "변동없음"으로 표시한다 (화살표 없음).
export function computeStatTrend(
  stat: AdminStatWithTrend,
  period: TrendPeriod
): { text: string; direction: "up" | "down" | "none" } {
  const previous = stat[period];
  if (stat.value == null || previous == null || previous === 0) {
    return { text: "변동없음", direction: "none" };
  }
  const percent = Math.round(((stat.value - previous) / previous) * 100);
  if (percent === 0) {
    return { text: "변동없음", direction: "none" };
  }
  return {
    text: `${percent > 0 ? "+" : ""}${percent}%`,
    direction: percent > 0 ? "up" : "down",
  };
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
