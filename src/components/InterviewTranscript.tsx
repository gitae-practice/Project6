import { INTERVIEWER_ORDER, INTERVIEWER_META, INTERVIEWER_ICON, INTERVIEWER_ACCENT } from "@/lib/interview/roles";
import { isKickoffTurn, type HistoryByRole } from "@/lib/interview/transcript";

// 세 면접관과 나눈 대화 전문을 역할별로 묶어서 보여준다.
// 방금 끝난 면접 종료 화면과 지난 기록 상세 화면에서 공통으로 쓴다 (PDF 다운로드에도 그대로 포함됨).
export function InterviewTranscript({ history }: { history: HistoryByRole }) {
  return (
    <div className="flex flex-col gap-6 text-left">
      <p className="text-sm font-medium text-muted">전체 대화</p>
      {INTERVIEWER_ORDER.map((role) => {
        const Icon = INTERVIEWER_ICON[role];
        const accent = INTERVIEWER_ACCENT[role];
        const turns = history[role].filter((turn) => !isKickoffTurn(turn));
        if (turns.length === 0) return null;

        return (
          <div key={role} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${accent.softBg}`}>
                <Icon className={`h-3.5 w-3.5 ${accent.text}`} />
              </span>
              <p className="font-medium">{INTERVIEWER_META[role].label}</p>
            </div>
            <div className="flex flex-col gap-3">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={`w-full rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    turn.role === "user" ? "border border-accent/20 bg-accent/10" : "glass-card"
                  }`}
                >
                  {turn.content}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
