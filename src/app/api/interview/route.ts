import type { NextRequest } from "next/server";
import { anthropic, INTERVIEW_MODEL } from "@/lib/anthropic";
import { SYSTEM_PROMPTS, type InterviewerRole } from "@/lib/interview/roles";
import { createClient } from "@/lib/supabase/server";

// Anthropic SDK를 쓰려면 Node.js 런타임이 필요하다 (Edge 런타임 불가).
export const runtime = "nodejs";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface InterviewRequestBody {
  sessionId: string | null; // 없으면 이번 요청에서 새로 생성
  interviewerRole: InterviewerRole;
  messages: ChatTurn[]; // 지금까지의 대화 전체 (Claude API는 상태를 저장하지 않음)
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as InterviewRequestBody;
  const { interviewerRole, messages } = body;
  let { sessionId } = body;

  if (!SYSTEM_PROMPTS[interviewerRole]) {
    return Response.json({ error: "알 수 없는 면접관 역할입니다." }, { status: 400 });
  }

  const supabase = await createClient();

  // 세션이 없으면 새로 생성 (첫 질문일 때)
  if (!sessionId) {
    const { data, error } = await supabase
      .from("interview_sessions")
      .insert({})
      .select("id")
      .single();

    if (error) {
      return Response.json({ error: `세션 생성 실패: ${error.message}` }, { status: 500 });
    }
    sessionId = data.id as string;
  }

  // 방금 사용자가 보낸 답변을 DB에 저장 (마지막 메시지가 user 턴)
  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage?.role === "user") {
    await supabase.from("interview_messages").insert({
      session_id: sessionId,
      interviewer_role: interviewerRole,
      sender: "user",
      content: lastUserMessage.content,
    });
  }

  const encoder = new TextEncoder();
  let assistantFullText = "";

  // Claude의 스트리밍 응답을 Server-Sent Events 형식으로 그대로 프론트에 중계한다.
  const stream = new ReadableStream({
    async start(controller) {
      // 세션 ID를 가장 먼저 보내서 클라이언트가 다음 요청부터 재사용하게 한다.
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ sessionId })}\n\n`)
      );

      const claudeStream = anthropic.messages.stream({
        model: INTERVIEW_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPTS[interviewerRole],
        messages,
      });

      claudeStream.on("text", (delta) => {
        assistantFullText += delta;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`)
        );
      });

      try {
        await claudeStream.finalMessage();

        // 완성된 면접관 답변을 DB에 저장
        await supabase.from("interview_messages").insert({
          session_id: sessionId,
          interviewer_role: interviewerRole,
          sender: "assistant",
          content: assistantFullText,
        });

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
