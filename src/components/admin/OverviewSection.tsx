"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Users,
  MessagesSquare,
  ClipboardCheck,
  Star,
  Clock,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
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
  month: "최근 한 달 면접 시작 추이", // 달마다 날짜 수가 달라(28~31일) "30일"로 고정 표기하지 않는다
};

// 추이 차트는 기간에 따라 막대 개수가 24개/30개까지 늘어나는데, 라벨을 솎아내는 방식은 아무리
// 다듬어도 칼럼 폭이 좁아 라벨이 겹치거나 카드 밖으로 삐져나가는 문제가 반복됐다. 그래서 막대마다
// 고정 폭을 주고 라벨을 전부 그대로 표시하되, 카드 폭을 넘치면 가로 스크롤(+마우스 드래그)로
// 넘겨보게 한다 — 데이터가 적을 때(예: 주=7개)는 고정 폭 합이 카드 폭보다 작아서 지금처럼 꽉 차게
// 보이고, 많을 때(일=24개/월=30개)만 자연스럽게 스크롤 영역이 된다.
const TREND_BAR_WIDTH_PX = 40;

// 추이 차트의 가로 스크롤 하나를 통째로 담당하는 훅 — ① 마우스 클릭+드래그로 넘기기,
// ② 좌우 끝에 화살표 버튼을 보여줄지 말지(스크롤 위치에 따라), ③ 화살표를 누르고 있는 동안
// 마우스 휠 클릭(오토스크롤)처럼 천천히 계속 이동하는 것까지 한 곳에서 처리한다.
//
// useRef가 아니라 useState로 DOM 노드를 들고 있는 이유 — 이 스크롤 영역은 데이터 로딩이 끝나야
// 조건부로 렌더링되는데, useRef라면 "노드가 아직 없을 때(로딩 중) 한 번 실행되고 끝나는" 일반
// useEffect(deps: [])는 그 이후 실제 노드가 마운트돼도 다시 실행되지 않아 리스너가 아예 안 붙는다.
// state로 들고 있으면 노드가 마운트/언마운트될 때마다(ref 콜백) state가 바뀌면서 effect가 다시
// 실행되어, 실제로 존재하는 노드에 정확히 리스너를 붙였다 뗄 수 있다.
function useHorizontalScrollController<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, [el]);

  // 스크롤 위치가 바뀌거나(휠/드래그/화살표), 카드 크기·데이터(막대 개수)가 바뀌어 전체 너비가
  // 달라질 때마다 화살표를 다시 보여줄지 판단한다. ResizeObserver는 observe()를 호출하면 최초
  // 한 번은 비동기로 알아서 콜백을 실행해주므로, 초기 상태를 맞추려고 effect 안에서 따로
  // updateScrollState()를 동기 호출할 필요가 없다 (그렇게 하면 react-hooks/set-state-in-effect에 걸림).
  useEffect(() => {
    if (!el) return;
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);
    el.addEventListener("scroll", updateScrollState);
    return () => {
      resizeObserver.disconnect();
      el.removeEventListener("scroll", updateScrollState);
    };
  }, [el, updateScrollState]);

  // 마우스 클릭+드래그로 스크롤 — 터치 화면은 브라우저가 이미 가로 스크롤을 지원하므로
  // pointerType이 "mouse"일 때만 끼어든다.
  useEffect(() => {
    if (!el) return;

    let isDragging = false;
    let startX = 0;
    let startScrollLeft = 0;

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType !== "mouse" || !el) return;
      isDragging = true;
      startX = e.clientX;
      startScrollLeft = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
    }
    function handlePointerMove(e: PointerEvent) {
      if (!isDragging || !el) return;
      el.scrollLeft = startScrollLeft - (e.clientX - startX);
    }
    function handlePointerUp() {
      isDragging = false;
    }

    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("pointermove", handlePointerMove);
    el.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("pointercancel", handlePointerUp);
    return () => {
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("pointermove", handlePointerMove);
      el.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [el]);

  // 화살표 버튼을 누르고 있는 동안 requestAnimationFrame으로 한 프레임씩 조금씩 옮겨서
  // "마우스 휠 클릭(오토스크롤)"처럼 천천히 계속 이동하는 느낌을 낸다. 살짝 눌렀다 떼면
  // 몇 프레임만 움직여 조금만 이동하고, 계속 누르고 있으면 끝까지 부드럽게 흘러간다.
  const autoScrollDirRef = useRef<0 | 1 | -1>(0);
  const autoScrollFrameRef = useRef<number | null>(null);
  const AUTO_SCROLL_SPEED_PX = 6; // 프레임당 이동량 — 값을 키우면 더 빨라진다

  const stopAutoScroll = useCallback(() => {
    autoScrollDirRef.current = 0;
    if (autoScrollFrameRef.current != null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback(
    (direction: 1 | -1) => {
      if (!el) return;
      autoScrollDirRef.current = direction;
      function step() {
        if (!el || autoScrollDirRef.current === 0) return;
        el.scrollLeft += autoScrollDirRef.current * AUTO_SCROLL_SPEED_PX;
        autoScrollFrameRef.current = requestAnimationFrame(step);
      }
      if (autoScrollFrameRef.current == null) {
        autoScrollFrameRef.current = requestAnimationFrame(step);
      }
    },
    [el]
  );

  // 컴포넌트가 사라질 때 혹시 진행 중이던 애니메이션 프레임이 남아있지 않게 정리한다.
  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  return { setEl, canScrollLeft, canScrollRight, startAutoScroll, stopAutoScroll };
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

  // 훅이 반환하는 객체를 "trendScroll.xxx"처럼 JSX 안에서 바로 점(.) 접근하면, 내부적으로 ref를
  // 쓰는 훅이라는 이유로 린터(react-hooks/refs)가 "렌더링 중 ref 접근"으로 과탐지한다.
  // 호출 시점에 바로 구조분해해서 평범한 지역 변수로 만들어두면 그 오탐이 사라진다.
  const {
    setEl: setTrendScrollEl,
    canScrollLeft: canScrollTrendLeft,
    canScrollRight: canScrollTrendRight,
    startAutoScroll: startTrendAutoScroll,
    stopAutoScroll: stopTrendAutoScroll,
  } = useHorizontalScrollController<HTMLDivElement>();

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

          {/* 면접 시작 추이 — 일=시간별 24개, 주=일별 7개, 월=일별 30개 안팎. 막대 개수가 많아 카드
              폭을 넘치면 라벨을 솎아내는 대신 가로 스크롤(마우스 드래그 또는 좌우 화살표 버튼)로
              넘겨본다. 화살표는 실제로 더 넘길 방향이 있을 때만 나타난다. */}
          <div className="glass-card flex flex-col gap-4 rounded-xl p-5">
            <p className="text-sm font-medium text-muted">{TREND_LABEL[period]}</p>
            {chartsLoading || !charts ? (
              <p className="text-xs text-muted">불러오는 중...</p>
            ) : (
              <div className="relative">
                {canScrollTrendLeft && (
                  <button
                    type="button"
                    aria-label="이전 시점으로 스크롤"
                    onPointerDown={() => startTrendAutoScroll(-1)}
                    onPointerUp={stopTrendAutoScroll}
                    onPointerLeave={stopTrendAutoScroll}
                    className="absolute top-10 left-0 z-10 -translate-y-1/2 rounded-full border border-border bg-surface p-1 text-muted shadow-sm hover:text-foreground"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                {canScrollTrendRight && (
                  <button
                    type="button"
                    aria-label="다음 시점으로 스크롤"
                    onPointerDown={() => startTrendAutoScroll(1)}
                    onPointerUp={stopTrendAutoScroll}
                    onPointerLeave={stopTrendAutoScroll}
                    className="absolute top-10 right-0 z-10 -translate-y-1/2 rounded-full border border-border bg-surface p-1 text-muted shadow-sm hover:text-foreground"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                <div
                  ref={setTrendScrollEl}
                  className="no-scrollbar flex h-32 cursor-grab items-end justify-between gap-1 overflow-x-auto overflow-y-hidden pb-1 select-none active:cursor-grabbing"
                >
                  {charts.trend.map((point) => (
                    <div
                      key={point.label}
                      className="flex flex-none flex-col items-center gap-1.5"
                      style={{ width: `${TREND_BAR_WIDTH_PX}px` }}
                    >
                      <span className="text-[10px] text-muted">{point.count > 0 ? point.count : ""}</span>
                      <div
                        className="w-full rounded-t-md bg-accent"
                        style={{ height: `${(point.count / maxTrendCount) * 100}%`, minHeight: point.count > 0 ? "4px" : "1px" }}
                      />
                      <span className="text-[9px] whitespace-nowrap text-muted">{point.label}</span>
                    </div>
                  ))}
                </div>
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
