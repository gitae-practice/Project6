"use client";

import { useEffect, useRef, useState } from "react";
import {
  INTERVIEWER_ORDER,
  INTERVIEWER_META,
  type InterviewerRole,
} from "@/lib/interview/roles";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

// 면접관마다 대화 히스토리를 따로 관리한다.
// (기술 면접관과 나눈 대화를 인성 면접관에게 그대로 넘기면 맥락이 뒤섞이므로 분리)
type HistoryByRole = Record<InterviewerRole, ChatTurn[]>;

const EMPTY_HISTORY: HistoryByRole = {
  technical: [],
  personality: [],
  pressure: [],
};

export function InterviewChat() {
  const [started, setStarted] = useState(false);
  const [interviewerIndex, setInterviewerIndex] = useState(0);
  const [history, setHistory] = useState<HistoryByRole>(EMPTY_HISTORY);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finished, setFinished] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRole = INTERVIEWER_ORDER[interviewerIndex];
  const currentMessages = history[currentRole];

  // 새 메시지가 추가될 때마다 대화창을 맨 아래로 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [currentMessages]);

  // Claude 스트리밍 응답(SSE)을 받아 현재 면접관의 대화 기록에 실시간으로 반영한다.
  async function sendMessage(role: InterviewerRole, messages: ChatTurn[]) {
    setIsStreaming(true);

    const response = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, interviewerRole: role, messages }),
    });

    if (!response.body) {
      setIsStreaming(false);
      return;
    }

    // 스트리밍으로 들어오는 assistant 답변을 담을 빈 메시지를 먼저 추가
    setHistory((prev) => ({
      ...prev,
      [role]: [...prev[role], { role: "assistant", content: "" }],
    }));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? ""; // 마지막 조각은 아직 완성 안 됐을 수 있으니 버퍼에 남김

      for (const event of events) {
        const line = event.replace(/^data: /, "").trim();
        if (!line || line === "[DONE]") continue;

        const payload = JSON.parse(line) as {
          sessionId?: string;
          text?: string;
          error?: string;
        };

        if (payload.sessionId) setSessionId(payload.sessionId);

        if (payload.text) {
          setHistory((prev) => {
            const updated = [...prev[role]];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = {
              ...last,
              content: last.content + payload.text,
            };
            return { ...prev, [role]: updated };
          });
        }
      }
    }

    setIsStreaming(false);
  }

  // 특정 면접관의 첫 질문을 받기 위한 트리거 메시지 (화면에는 표시하지 않음).
  // "면접 시작하기"와 "다음 면접관으로" 두 곳에서 공용으로 쓴다.
  function startInterviewer(role: InterviewerRole) {
    const kickoff: ChatTurn = {
      role: "user",
      content: "면접을 시작해주세요. 짧게 자기소개를 요청한 뒤 첫 질문을 해주세요.",
    };
    setHistory((prev) => ({ ...prev, [role]: [kickoff] }));
    void sendMessage(role, [kickoff]);
  }

  function handleStart() {
    setStarted(true);
    startInterviewer(currentRole);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userTurn: ChatTurn = { role: "user", content: input.trim() };
    const nextMessages = [...currentMessages, userTurn];

    setHistory((prev) => ({ ...prev, [currentRole]: nextMessages }));
    setInput("");
    void sendMessage(currentRole, nextMessages);
  }

  function handleNextInterviewer() {
    const nextIndex = interviewerIndex + 1;
    if (nextIndex >= INTERVIEWER_ORDER.length) {
      setFinished(true);
      return;
    }
    setInterviewerIndex(nextIndex);
    setSessionId(null); // 면접관이 바뀌면 새 세션으로 취급 (DB에는 role별로 이미 구분 저장됨)
    startInterviewer(INTERVIEWER_ORDER[nextIndex]); // 다음 면접관의 첫 질문을 바로 받아온다
  }

  // 면접 종료 후 처음 상태로 되돌려서 새로 시작할 수 있게 한다.
  function handleRestart() {
    setStarted(false);
    setFinished(false);
    setInterviewerIndex(0);
    setHistory(EMPTY_HISTORY);
    setSessionId(null);
    setInput("");
  }

  if (!started) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <h1 className="max-w-md text-3xl font-bold leading-snug sm:text-4xl">
          오늘의 면접관
        </h1>
        <p className="max-w-sm text-muted">
          기술을 묻고, 사람을 보고, 압박을 견딘다.
        </p>
        <button
          type="button"
          onClick={handleStart}
          className="rounded-xl bg-accent px-6 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          시작하기
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-2xl font-bold">면접 종료</p>
        <p className="text-muted">세 사람과의 대화를 모두 마쳤습니다. 수고하셨습니다.</p>
        <button
          type="button"
          onClick={handleRestart}
          className="rounded-xl border border-border px-5 py-2.5 text-sm transition-colors hover:border-accent hover:text-accent"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* 진행 상태 표시: 현재 어느 면접관 차례인지 */}
      <div className="flex justify-center gap-2 border-b border-border px-4 py-3">
        {INTERVIEWER_ORDER.map((role, i) => (
          <span
            key={role}
            className={`rounded-full px-3 py-1 text-sm ${
              i === interviewerIndex
                ? "bg-accent text-accent-foreground"
                : i < interviewerIndex
                  ? "bg-border text-muted"
                  : "text-muted"
            }`}
          >
            {INTERVIEWER_META[role].emoji} {INTERVIEWER_META[role].label}
          </span>
        ))}
      </div>

      {/* 대화 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {currentMessages
            .filter((m, i) => !(i === 0 && m.content.startsWith("면접을 시작해주세요"))) // 트리거 메시지는 화면에서 숨김
            .map((message, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "self-end bg-accent text-accent-foreground"
                    : "self-start border border-border bg-surface"
                }`}
              >
                {message.content || (isStreaming && i === currentMessages.length - 1 ? "…" : "")}
              </div>
            ))}
        </div>
      </div>

      {/* 다음 면접관으로 넘어가기 (스트리밍이 끝난 뒤에만 노출) */}
      {!isStreaming && currentMessages.length > 1 && (
        <div className="flex justify-center border-t border-border px-4 py-2">
          <button
            type="button"
            onClick={handleNextInterviewer}
            className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            {interviewerIndex + 1 >= INTERVIEWER_ORDER.length
              ? "면접 마치기"
              : `다음 면접관(${INTERVIEWER_META[INTERVIEWER_ORDER[interviewerIndex + 1]].label})으로`}
          </button>
        </div>
      )}

      {/* 답변 입력창 */}
      <form onSubmit={handleSubmit} className="border-t border-border p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="답변을 입력하세요..."
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-2 outline-none focus:border-accent"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-xl bg-accent px-5 py-2 font-medium text-accent-foreground transition-opacity disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </form>
    </div>
  );
}
