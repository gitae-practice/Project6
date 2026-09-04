"use client";

import { useState } from "react";
import { Users, MessagesSquare, ClipboardCheck, Star, Clock, UserPlus, type LucideIcon } from "lucide-react";
import { computeFlowTrend, computeStatTrend, type AdminDashboardStats, type TrendPeriod } from "@/lib/admin";

const PERIOD_OPTIONS: { key: TrendPeriod; label: string }[] = [
  { key: "day", label: "일" },
  { key: "week", label: "주" },
  { key: "month", label: "월" },
];

// 신규 가입자는 값 자체가 선택된 기간에 따라 "오늘/이번 주/이번 달"로 의미가 바뀌므로 라벨도 같이 바꾼다.
const NEW_USERS_LABEL: Record<TrendPeriod, string> = {
  day: "오늘 신규 가입자",
  week: "이번 주 신규 가입자",
  month: "이번 달 신규 가입자",
};

// 스탯 카드 하나를 그리는 공통 UI — 값/라벨/증감 문구만 받으면 스톡·플로우 지표 둘 다 그린다.
function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
  trend: { text: string; direction: "up" | "down" | "none" };
}) {
  return (
    <div className="glass-card flex flex-col gap-2 rounded-xl p-4">
      <Icon className={`h-4 w-4 ${accent}`} />
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
      <p
        className={`flex items-center gap-1 text-xs ${
          trend.direction === "up" ? "text-emerald-400" : trend.direction === "down" ? "text-red-400" : "text-muted"
        }`}
      >
        {trend.direction === "up" && <span aria-hidden="true">▲</span>}
        {trend.direction === "down" && <span aria-hidden="true">▼</span>}
        {trend.text}
      </p>
    </div>
  );
}

// 개요 탭 — 요약 지표 카드 + 인기 직무/7일 추이/점수 분포 막대그래프.
// 전부 admin_dashboard_stats() 하나가 미리 집계해서 준 숫자만 그린다 (개인정보 없음).
export function OverviewSection({ stats }: { stats: AdminDashboardStats }) {
  const [period, setPeriod] = useState<TrendPeriod>("day");

  const maxJobRoleCount = Math.max(1, ...stats.top_job_roles.map((r) => r.count));
  const maxDailyCount = Math.max(1, ...stats.sessions_last_7_days.map((d) => d.count));
  const maxScoreCount = Math.max(1, ...stats.score_distribution.map((s) => s.count));

  return (
    <div className="flex flex-col gap-4">
      {/* 개요 탭 상단 우측 — 스탯 카드 증감률의 비교 기준(일/주/월) 토글 */}
      <div className="flex justify-end">
        <div className="flex w-fit rounded-lg border border-border p-0.5 text-xs">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                period === key ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 지표 6개 — 각 카드 하단에 선택된 기간 기준 증감 표시 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
        <StatCard
          label="총 가입자"
          value={stats.total_users.value ?? "-"}
          icon={Users}
          accent="text-blue-400"
          trend={computeStatTrend(stats.total_users, period)}
        />
        <StatCard
          label="총 면접 세션"
          value={stats.total_sessions.value ?? "-"}
          icon={MessagesSquare}
          accent="text-orange-400"
          trend={computeStatTrend(stats.total_sessions, period)}
        />
        <StatCard
          label="완료된 면접"
          value={stats.completed_interviews.value ?? "-"}
          icon={ClipboardCheck}
          accent="text-green-400"
          trend={computeStatTrend(stats.completed_interviews, period)}
        />
        <StatCard
          label="진행 중인 면접"
          value={stats.in_progress_sessions.value ?? "-"}
          icon={Clock}
          accent="text-amber-400"
          trend={computeStatTrend(stats.in_progress_sessions, period)}
        />
        {/* 신규 가입자는 스톡이 아니라 플로우 지표라 값·라벨 모두 선택된 기간에 따라 바뀐다 */}
        <StatCard
          label={NEW_USERS_LABEL[period]}
          value={stats.new_users[period].value ?? "-"}
          icon={UserPlus}
          accent="text-purple-400"
          trend={computeFlowTrend(stats.new_users, period)}
        />
        <StatCard
          label="평균 점수"
          value={stats.average_score.value != null ? stats.average_score.value.toFixed(1) : "-"}
          icon={Star}
          accent="text-red-400"
          trend={computeStatTrend(stats.average_score, period)}
        />
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
