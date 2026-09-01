import type { InterviewerRole } from "./roles";

// 면접관 한 명과 주고받은 대화 한 턴.
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// 면접관별로 나뉜 대화 전체. 진행 화면(InterviewChat), 평가 리포트 생성(/api/interview/report),
// 지난 기록 상세 페이지(history/[id]), PDF 다운로드까지 전부 이 모양을 공유한다.
export type HistoryByRole = Record<InterviewerRole, ChatTurn[]>;

// 면접 시작을 알리는 트리거 메시지 접두사 — 실제 지원자가 쓴 말이 아니므로
// 화면에 보여주거나, 리포트를 만들거나, PDF로 내보낼 때 전부 제외해야 한다.
const KICKOFF_PREFIX = "면접을 시작해주세요";

export function isKickoffTurn(turn: ChatTurn): boolean {
  return turn.role === "user" && turn.content.startsWith(KICKOFF_PREFIX);
}
