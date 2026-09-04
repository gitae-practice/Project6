import { Users, MessagesSquare, ClipboardCheck, Star, Clock, UserPlus } from "lucide-react";
import { computeStatTrend, type AdminDashboardStats, type AdminStatWithTrend } from "@/lib/admin";

// 개요 탭 — 요약 지표 카드 + 인기 직무/7일 추이/점수 분포 막대그래프.
// 전부 admin_dashboard_stats() 하나가 미리 집계해서 준 숫자만 그린다 (개인정보 없음).
export function OverviewSection({ stats }: { stats: AdminDashboardStats }) {
  const maxJobRoleCount = Math.max(1, ...stats.top_job_roles.map((r) => r.count));
  const maxDailyCount = Math.max(1, ...stats.sessions_last_7_days.map((d) => d.count));
  const maxScoreCount = Math.max(1, ...stats.score_distribution.map((s) => s.count));

  const statCards: {
    label: string;
    stat: AdminStatWithTrend;
    icon: typeof Users;
    accent: string;
    isScore?: boolean;
  }[] = [
    { label: "총 가입자", stat: stats.total_users, icon: Users, accent: "text-blue-400" },
    { label: "총 면접 세션", stat: stats.total_sessions, icon: MessagesSquare, accent: "text-orange-400" },
    { label: "완료된 면접", stat: stats.completed_interviews, icon: ClipboardCheck, accent: "text-green-400" },
    { label: "진행 중인 면접", stat: stats.in_progress_sessions, icon: Clock, accent: "text-amber-400" },
    { label: "오늘 신규 가입자", stat: stats.new_users_today, icon: UserPlus, accent: "text-purple-400" },
    { label: "평균 점수", stat: stats.average_score, icon: Star, accent: "text-red-400", isScore: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 지표 6개 — 각 카드 하단에 전주 대비 증감률 표시 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        {statCards.map(({ label, stat, icon: Icon, accent, isScore }) => {
          const trend = computeStatTrend(stat);
          return (
            <div key={label} className="glass-card flex flex-col gap-2 rounded-xl p-4">
              <Icon className={`h-4 w-4 ${accent}`} />
              <p className="text-2xl font-bold">
                {stat.value == null ? "-" : isScore ? stat.value.toFixed(1) : stat.value}
              </p>
              <p className="text-xs text-muted">{label}</p>
              <p
                className={`flex items-center gap-1 text-xs ${
                  trend.direction === "up"
                    ? "text-emerald-400"
                    : trend.direction === "down"
                      ? "text-red-400"
                      : "text-muted"
                }`}
              >
                {trend.direction === "up" && <span aria-hidden="true">▲</span>}
                {trend.direction === "down" && <span aria-hidden="true">▼</span>}
                {trend.text}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

        {/* 점수 구간별 분포 */}
        <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
          <p className="text-sm font-medium text-muted">점수 분포</p>
          <div className="flex h-32 items-end justify-between gap-2">
            {stats.score_distribution.map((bucket) => (
              <div key={bucket.range} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs text-muted">{bucket.count}</span>
                <div
                  className="w-full rounded-t-md bg-accent"
                  style={{
                    height: `${(bucket.count / maxScoreCount) * 100}%`,
                    minHeight: bucket.count > 0 ? "4px" : "1px",
                  }}
                />
                <span className="text-[10px] text-muted">{bucket.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
