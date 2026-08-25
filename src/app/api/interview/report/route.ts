import type { NextRequest } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, INTERVIEW_MODEL } from "@/lib/anthropic";
import { INTERVIEWER_META, INTERVIEWER_ORDER, type InterviewerRole } from "@/lib/interview/roles";
import { InterviewReportSchema } from "@/lib/interview/report";

export const runtime = "nodejs";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

type HistoryByRole = Record<InterviewerRole, ChatTurn[]>;

// 면접 시작을 알리는 트리거 메시지는 실제 대화 내용이 아니므로 리포트 생성 시 제외한다.
function isKickoffMessage(turn: ChatTurn) {
  return turn.role === "user" && turn.content.startsWith("면접을 시작해주세요");
}

// 3명의 면접관과 나눈 대화를 한 편의 텍스트로 합쳐 평가 모델이 읽기 좋게 만든다.
function buildTranscript(history: HistoryByRole): string {
  return INTERVIEWER_ORDER.map((role) => {
    const lines = history[role]
      .filter((turn) => !isKickoffMessage(turn))
      .map((turn) => `${turn.role === "user" ? "지원자" : INTERVIEWER_META[role].label}: ${turn.content}`)
      .join("\n");
    return `### ${INTERVIEWER_META[role].label}\n${lines || "(대화 없음)"}`;
  }).join("\n\n");
}

export async function POST(request: NextRequest) {
  const { history } = (await request.json()) as { history: HistoryByRole };

  const transcript = buildTranscript(history);

  const response = await anthropic.messages.parse({
    model: INTERVIEW_MODEL,
    max_tokens: 2048,
    system:
      "당신은 채용 면접 결과를 채점하는 평가관입니다. 세 명의 면접관(기술/인성/압박)과 지원자가 나눈 대화 전체를 읽고 객관적으로 평가하세요. 근거 없이 후하게 점수를 주지 말고, 실제 답변 내용에 기반해 평가하세요.",
    messages: [{ role: "user", content: transcript }],
    output_config: { format: zodOutputFormat(InterviewReportSchema) },
  });

  if (!response.parsed_output) {
    return Response.json({ error: "리포트 생성에 실패했습니다. 다시 시도해주세요." }, { status: 502 });
  }

  return Response.json(response.parsed_output);
}
