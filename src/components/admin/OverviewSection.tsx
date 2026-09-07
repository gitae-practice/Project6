"use client";

import { useEffect, useState } from "react";
import { Users, MessagesSquare, ClipboardCheck, Star, Clock, UserPlus, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  computeFlowTrend,
  computeStatTrend,
  type AdminDashboardStats,
  type AdminPeriodCharts,
  type TrendPeriod,
} from "@/lib/admin";

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

// 하단 3개 차트도 신규 가입자처럼 값 자체가 기간에 따라 달라지는 집계라 제목을 같이 바꾼다.
const JOB_ROLES_LABEL: Record<TrendPeriod, string> = {
  day: "오늘 인기 지원 직무 TOP5",
  week: "이번 주 인기 지원 직무 TOP5",
  month: "이번 달 인기 지원 직무 TOP5",
};
const SCORE_DIST_LABEL: Record<TrendPeriod, string> = {
  day: "오늘 점수 분포",
  week: "이번 주 점수 분포",
  month: "이번 달 점수 분포",
};
const TREND_LABEL: Record<TrendPeriod, string> = {
  day: "오늘 시간대별 면접 시작 추이",
  week: "최근 7일 면접 시작 추이",
  month: "최근 30일 면접 시작 추이",
};

// 추이 차트의 포인트 개수(일=24/주=7/월=30)가 maxLabels보다 많으면 일정 간격으로만 라벨을 남긴다.
// 가장 최근 포인트(맨 끝, index length-1)를 기준으로 뒤에서부터 간격을 두고, 맨 처음(index 0)도
// 항상 포함해서 — 라벨이 다닥다닥 붙어 겹쳐 보이는 걸 막으면서도 차트의 시작/끝은 항상 보이게 한다.
function pickTrendLabelIndices(length: number, maxLabels: number): Set<number> {
  if (length === 0) return new Set();
  if (length <= maxLabels) return new Set(Array.from({ length }, (_, i) => i));
  const step = Math.ceil(length / maxLabels);
  const indices = new Set<number>();
  for (let i = length - 1; i >= 0; i -= step) indices.add(i);
  indices.add(0);
  return indices;
}

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

// 개요 탭 — 요약 지표 카드 + 인기 직무/추이/점수 분포. 카드 6개는 admin_dashboard_stats()가 한 번에
// 준 값을 그대로 쓰고, 하단 3개 차트는 일/주/월 토글이 바뀔 때마다 admin_period_charts(period)를
// 새로 호출해서 그 기간만큼 다시 집계한 결과로 완전히 새로 그린다.
export function OverviewSection({ stats }: { stats: AdminDashboardStats }) {
  const [period, setPeriod] = useState<TrendPeriod>("day");

  // 요청을 보낸 기간(period)까지 결과에 같이 담아둔다 — 그래야 "지금 이 결과가 현재 선택된
  // 기간에 대한 응답인지"를 별도의 로딩 setState 없이 렌더링 시점에 바로 비교해서 판단할 수 있다
  // (effect 안에서 setState를 동기적으로 먼저 호출하면 react-hooks/set-state-in-effect에 걸린다).
  const [chartsResult, setChartsResult] = useState<
    { period: TrendPeriod; data: AdminPeriodCharts } | { period: TrendPeriod; error: string } | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.rpc("admin_period_charts", { p_period: period }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setChartsResult({ period, error: error.message });
      else setChartsResult({ period, data: data as AdminPeriodCharts });
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const isCurrent = chartsResult?.period === period;
  const charts = isCurrent && chartsResult && "data" in chartsResult ? chartsResult.data : null;
  const chartsError = isCurrent && chartsResult && "error" in chartsResult ? chartsResult.error : null;
  const chartsLoading = !isCurrent;

  const maxJobRoleCount = Math.max(1, ...(charts?.top_job_roles.map((r) => r.count) ?? []));
  const maxTrendCount = Math.max(1, ...(charts?.trend.map((d) => d.count) ?? []));
  const maxScoreCount = Math.max(1, ...(charts?.score_distribution.map((s) => s.count) ?? []));

  // 추이 차트 포인트가 많을 때(일=24개/월=30개) 막대마다 라벨을 다 붙이면 서로 겹쳐서 깨져 보이므로
  // 최대 개수만 남기고 솎아낸다. 가장 최근 시점(오늘/지금)과 가장 오래된 시점은 항상 남겨서
  // 차트가 어디서부터 어디까지인지 양 끝을 알아볼 수 있게 한다.
  const trendLabelIndices = pickTrendLabelIndices(charts?.trend.length ?? 0, period === "week" ? 7 : 8);

  return (
    <div className="flex flex-col gap-4">
      {/* 개요 탭 상단 우측 — 스탯 카드 증감률 + 하단 차트 집계 기간(일/주/월) 토글 */}
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

      {chartsError ? (
        <p className="glass-card rounded-xl p-5 text-sm text-red-400">차트를 불러오지 못했습니다: {chartsError}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 인기 지원 직무 TOP 5 */}
          <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
            <p className="text-sm font-medium text-muted">{JOB_ROLES_LABEL[period]}</p>
            {chartsLoading || !charts ? (
              <p className="text-xs text-muted">불러오는 중...</p>
            ) : charts.top_job_roles.length === 0 ? (
              <p className="text-xs text-muted">아직 데이터가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {charts.top_job_roles.map((row) => (
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

          {/* 면접 시작 추이 — 일=시간별, 주=일별 7개, 월=일별 30개 */}
          <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
            <p className="text-sm font-medium text-muted">{TREND_LABEL[period]}</p>
            {chartsLoading || !charts ? (
              <p className="text-xs text-muted">불러오는 중...</p>
            ) : (
              <div className="flex h-32 items-end justify-between gap-1">
                {charts.trend.map((point, i) => (
                  <div key={point.label} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[10px] text-muted">{point.count > 0 ? point.count : ""}</span>
                    <div
                      className="w-full rounded-t-md bg-accent"
                      style={{ height: `${(point.count / maxTrendCount) * 100}%`, minHeight: point.count > 0 ? "4px" : "1px" }}
                    />
                    <span className="text-[9px] whitespace-nowrap text-muted">
                      {trendLabelIndices.has(i) ? point.label : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 점수 구간별 분포 */}
          <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
            <p className="text-sm font-medium text-muted">{SCORE_DIST_LABEL[period]}</p>
            {chartsLoading || !charts ? (
              <p className="text-xs text-muted">불러오는 중...</p>
            ) : (
              <div className="flex h-32 items-end justify-between gap-2">
                {charts.score_distribution.map((bucket) => (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
