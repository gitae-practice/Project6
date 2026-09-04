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
// "총 가입자/총 세션" 같은 누적(스톡) 지표에 쓴다 — 지금 값 하나에 비교 시점만 여러 개다.
export interface AdminStatWithTrend {
  value: number | null;
  day: number | null;
  week: number | null;
  month: number | null;
}

// "신규 가입자"처럼 애초에 "어떤 기간 동안 새로 생긴 수"인 플로우 지표용 — 스톡 지표와 달리
// 값 자체가 일/주/월에 따라 달라지므로(오늘 vs 이번 주 vs 이번 달), 기간별로 값+비교값 쌍을 통째로 갖는다.
export interface AdminFlowStat {
  day: { value: number | null; previous: number | null };
  week: { value: number | null; previous: number | null };
  month: { value: number | null; previous: number | null };
}

// 개요 탭 상단의 "일 / 주 / 월" 토글이 고르는 비교 기준.
export type TrendPeriod = "day" | "week" | "month";

export interface AdminDashboardStats {
  total_users: AdminStatWithTrend;
  total_sessions: AdminStatWithTrend;
  completed_interviews: AdminStatWithTrend;
  average_score: AdminStatWithTrend;
  in_progress_sessions: AdminStatWithTrend;
  new_users: AdminFlowStat;
  top_job_roles: { job_role: string; count: number }[];
  sessions_last_7_days: { date: string; count: number }[];
  score_distribution: { range: string; count: number }[];
}

// 증감 문구 + 화살표 방향을 계산하는 실제 로직 — {value, previous} 한 쌍만 받으면 되므로
// 스톡 지표(computeStatTrend)와 플로우 지표(computeFlowTrend) 둘 다 이걸 공유한다.
// - 비교할 이전 값이 없으면(null) 비교 자체가 불가능하므로 "변동없음"
// - 값 차이가 없으면(0) 의미 있는 증감이 아니므로 "변동없음"
// - 그 외에는 "절대 증가량 / 퍼센트"를 같이 보여준다 (예: "+3 / +150%")
// - 단, 이전 값이 0이면 퍼센트를 정의할 수 없으니("0에서 몇 % 늘었다"는 말이 성립하지 않음,
//   0으로 나누기가 됨) 절대 증가량만 보여준다.
function computeTrendFromPair(pair: {
  value: number | null;
  previous: number | null;
}): { text: string; direction: "up" | "down" | "none" } {
  if (pair.value == null || pair.previous == null) {
    return { text: "변동없음", direction: "none" };
  }
  const diff = pair.value - pair.previous;
  if (diff === 0) {
    return { text: "변동없음", direction: "none" };
  }

  const direction = diff > 0 ? "up" : "down";
  const formattedDiff = Number.isInteger(diff) ? `${diff}` : diff.toFixed(1);
  const diffText = `${diff > 0 ? "+" : ""}${formattedDiff}`;

  if (pair.previous === 0) {
    return { text: diffText, direction };
  }

  const percent = Math.round((diff / pair.previous) * 100);
  const percentText = `${percent > 0 ? "+" : ""}${percent}%`;
  return { text: `${diffText} / ${percentText}`, direction };
}

export function computeStatTrend(
  stat: AdminStatWithTrend,
  period: TrendPeriod
): { text: string; direction: "up" | "down" | "none" } {
  return computeTrendFromPair({ value: stat.value, previous: stat[period] });
}

export function computeFlowTrend(
  stat: AdminFlowStat,
  period: TrendPeriod
): { text: string; direction: "up" | "down" | "none" } {
  return computeTrendFromPair(stat[period]);
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
  is_deleted: boolean; // 유저가 소프트 삭제한 세션 — 관리자에게는 그대로 보이되 표시만 다르게 함
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
