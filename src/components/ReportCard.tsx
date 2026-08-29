import { TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { INTERVIEWER_ORDER, INTERVIEWER_META, INTERVIEWER_ICON, INTERVIEWER_ACCENT } from "@/lib/interview/roles";
import type { InterviewReport } from "@/lib/interview/report";

// 점수 구간별 색상 — 8~10점 green / 5~7점 orange / 0~4점 red.
// SVG 링/숫자 색은 Tailwind 클래스가 아니라 실제 hex를 직접 넘기므로(원 그래프 stroke)
// JIT 클래스 생성 문제와 무관하게 자유롭게 계산해도 된다.
function scoreColor(score: number): { text: string; hex: string } {
  if (score >= 8) return { text: "text-green-400", hex: "#4ade80" };
  if (score >= 5) return { text: "text-orange-400", hex: "#fb923c" };
  return { text: "text-red-400", hex: "#f87171" };
}

// 원형 점수 게이지 (SVG arc) — 10점 만점 기준으로 링을 채운다.
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(Math.max(score, 0), 10) / 10;
  const offset = circumference * (1 - ratio);
  const { hex } = scoreColor(score);

  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
      <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="10" className="stroke-border" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        stroke={hex}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

// 종합 평가 리포트 카드. 방금 끝난 면접 화면과 지난 기록 상세 화면에서 공통으로 쓴다.
// Bento grid로 구성: 종합 점수 / 총평 / 면접관별 피드백 3칸 / 강점·보완할 점 2칸.
export function ReportCard({ report }: { report: InterviewReport }) {
  const { text: scoreTextColor } = scoreColor(report.overall_score);

  return (
    <div className="grid w-full grid-cols-1 gap-4 text-left md:grid-cols-6">
      {/* 종합 점수 카드 */}
      <div className="glass-card flex flex-col items-center justify-center gap-1 rounded-xl p-4 md:col-span-2 md:p-6">
        <div className="relative flex items-center justify-center">
          <ScoreRing score={report.overall_score} />
          <span className={`absolute text-4xl font-black ${scoreTextColor}`}>
            {report.overall_score.toFixed(1)}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">10점 만점 종합 점수</p>
      </div>

      {/* 총평 카드 */}
      <div className="glass-card flex flex-col justify-center gap-2 rounded-xl p-4 md:col-span-4 md:p-6">
        <p className="text-sm font-medium text-muted">총평</p>
        <p className="leading-relaxed">{report.summary}</p>
      </div>

      {/* 면접관별 피드백 3칸 */}
      {INTERVIEWER_ORDER.map((role) => {
        const Icon = INTERVIEWER_ICON[role];
        const accent = INTERVIEWER_ACCENT[role];
        return (
          <div
            key={role}
            className={`glass-card flex flex-col gap-2 rounded-xl border-t-2 p-4 md:col-span-2 md:p-5 ${accent.border}`}
          >
            <div className="flex items-center gap-2">
              <Icon className={`h-4 w-4 ${accent.text}`} />
              <p className="text-xs font-medium text-muted">{INTERVIEWER_META[role].label}</p>
            </div>
            <p className="text-sm leading-relaxed">{report.interviewer_feedback[role]}</p>
          </div>
        );
      })}

      {/* 강점 */}
      <div className="glass-card flex flex-col gap-3 rounded-xl p-4 md:col-span-3 md:p-5">
        <div className="flex items-center gap-2 text-green-400">
          <TrendingUp className="h-4 w-4" />
          <p className="text-xs font-medium">강점</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {report.strengths.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 보완할 점 */}
      <div className="glass-card flex flex-col gap-3 rounded-xl p-4 md:col-span-3 md:p-5">
        <div className="flex items-center gap-2 text-orange-400">
          <AlertTriangle className="h-4 w-4" />
          <p className="text-xs font-medium">보완할 점</p>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {report.improvements.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
