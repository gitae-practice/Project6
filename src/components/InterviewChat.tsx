"use client";

import { useEffect, useRef, useState } from "react";
import { UserRoundCog, UserRoundCheck, UserRoundSearch, type LucideIcon } from "lucide-react";
import {
  INTERVIEWER_ORDER,
  INTERVIEWER_META,
  type InterviewerRole,
} from "@/lib/interview/roles";
import type { InterviewReport } from "@/lib/interview/report";

// 면접관마다 다른 사람 아이콘을 부여한다 (톱니바퀴=기술, 체크=인성, 돋보기=압박/파고듦).
const INTERVIEWER_ICON: Record<InterviewerRole, LucideIcon> = {
  technical: UserRoundCog,
  personality: UserRoundCheck,
  pressure: UserRoundSearch,
};

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
  const [jobRole, setJobRole] = useState("");
  const [resumeSummary, setResumeSummary] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRole = INTERVIEWER_ORDER[interviewerIndex];
  const CurrentIcon = INTERVIEWER_ICON[currentRole];
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
      // jobRole/resumeSummary는 세션이 처음 만들어질 때만 서버에서 사용되고, 이후 요청에선 무시된다.
      body: JSON.stringify({ sessionId, interviewerRole: role, messages, jobRole, resumeSummary }),
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

  // 지원 직무/이력서 요약이 입력되어 있으면 첫 질문에 반영되도록 트리거 메시지에 같이 담는다.
  function buildKickoffMessage(): string {
    const job = jobRole.trim();
    const resume = resumeSummary.trim();
    if (!job && !resume) {
      return "면접을 시작해주세요. 짧게 자기소개를 요청한 뒤 첫 질문을 해주세요.";
    }
    const context = [job && `지원 직무: ${job}`, resume && `이력서/경력 요약: ${resume}`]
      .filter(Boolean)
      .join("\n");
    return `면접을 시작해주세요. 아래 지원자 정보를 참고해서 자기소개를 짧게 요청한 뒤 관련된 첫 질문을 해주세요.\n\n${context}`;
  }

  // 특정 면접관의 첫 질문을 받기 위한 트리거 메시지 (화면에는 표시하지 않음).
  // "면접 시작하기"와 "다음 면접관으로" 두 곳에서 공용으로 쓴다.
  function startInterviewer(role: InterviewerRole) {
    const kickoff: ChatTurn = { role: "user", content: buildKickoffMessage() };
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
      void generateReport(); // 마지막 면접관까지 끝났으니 바로 종합 리포트 생성 시작
      return;
    }
    setInterviewerIndex(nextIndex);
    // sessionId는 그대로 유지 — 면접 한 판(세 명 전부) = 세션 하나로 취급해야
    // 종료 후 리포트를 만들 때 전체 대화를 한 세션으로 묶어 조회할 수 있다.
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
    setJobRole("");
    setResumeSummary("");
    setReport(null);
    setReportError(null);
  }

  // 세 면접관과의 전체 대화(history)를 Claude에게 보내 종합 평가 리포트를 받아온다.
  // "면접 마치기" 클릭 시점(handleNextInterviewer)에서 직접 호출한다.
  async function generateReport() {
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const response = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history }),
      });
      if (!response.ok) throw new Error("리포트 요청 실패");
      setReport((await response.json()) as InterviewReport);
    } catch {
      setReportError("리포트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsGeneratingReport(false);
    }
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

        {/* 지원 직무/이력서 요약 — 입력하면 첫 질문에 반영됨, 둘 다 선택 사항 */}
        <div className="flex w-full max-w-sm flex-col gap-3 text-left">
          <div className="flex flex-col gap-1">
            <label htmlFor="jobRole" className="text-xs font-medium text-muted">
              지원 직무 (선택)
            </label>
            <input
              id="jobRole"
              type="text"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="예: 프론트엔드 개발자"
              className="rounded-xl border border-border bg-surface px-4 py-2 outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="resumeSummary" className="text-xs font-medium text-muted">
              이력서 / 경력 요약 (선택)
            </label>
            <textarea
              id="resumeSummary"
              value={resumeSummary}
              onChange={(e) => setResumeSummary(e.target.value)}
              rows={4}
              placeholder="최근 프로젝트, 주요 기술 스택 등을 간단히 적어주세요"
              className="resize-none rounded-xl border border-border bg-surface px-4 py-2 outline-none focus:border-accent"
            />
          </div>
        </div>

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
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-10 text-center">
        <p className="text-2xl font-bold">면접 종료</p>
        <p className="text-muted">세 사람과의 대화를 모두 마쳤습니다. 수고하셨습니다.</p>

        {isGeneratingReport && <p className="text-sm text-muted">평가 리포트를 만드는 중...</p>}
        {reportError && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-600">{reportError}</p>
            <button
              type="button"
              onClick={() => void generateReport()}
              className="rounded-lg border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
            >
              다시 시도
            </button>
          </div>
        )}

        {report && (
          <div className="w-full rounded-xl border border-border bg-surface p-6 text-left">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="font-medium">종합 점수</p>
              <p className="text-3xl font-bold text-accent">{report.overall_score.toFixed(1)} / 10</p>
            </div>
            <p className="mb-6 text-sm leading-relaxed">{report.summary}</p>

            <div className="mb-6 flex flex-col gap-3">
              {INTERVIEWER_ORDER.map((role) => {
                const Icon = INTERVIEWER_ICON[role];
                return (
                  <div key={role} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                      <Icon className="h-3.5 w-3.5 text-accent" />
                    </span>
                    <div>
                      <p className="text-xs font-medium text-muted">{INTERVIEWER_META[role].label}</p>
                      <p className="text-sm leading-relaxed">{report.interviewer_feedback[role]}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">강점</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {report.strengths.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">보완할 점</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {report.improvements.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

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
        {INTERVIEWER_ORDER.map((role, i) => {
          const Icon = INTERVIEWER_ICON[role];
          return (
            <span
              key={role}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm ${
                i === interviewerIndex
                  ? "bg-accent text-accent-foreground"
                  : i < interviewerIndex
                    ? "bg-border text-muted"
                    : "text-muted"
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {INTERVIEWER_META[role].label}
            </span>
          );
        })}
      </div>

      {/* 현재 대화 중인 면접관 프로필 헤더 */}
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <CurrentIcon className="h-5 w-5 text-accent" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{INTERVIEWER_META[currentRole].label}</p>
          <p className="truncate text-xs text-muted">{INTERVIEWER_META[currentRole].description}</p>
        </div>
      </div>

      {/* 대화 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {currentMessages
            .filter((m, i) => !(i === 0 && m.content.startsWith("면접을 시작해주세요"))) // 트리거 메시지는 화면에서 숨김
            .map((message, i) =>
              message.role === "user" ? (
                <div
                  key={i}
                  className="max-w-[85%] self-end rounded-xl bg-accent px-4 py-3 leading-relaxed whitespace-pre-wrap text-accent-foreground"
                >
                  {message.content}
                </div>
              ) : (
                <div key={i} className="flex max-w-[85%] items-start gap-2 self-start">
                  {/* 면접관 아바타 — 역할별 사람 아이콘으로 구분 (기술=톱니, 인성=체크, 압박=돋보기) */}
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                    <CurrentIcon className="h-4 w-4 text-accent" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted">
                      {INTERVIEWER_META[currentRole].label}
                    </span>
                    <div className="rounded-xl border border-border bg-surface px-4 py-3 leading-relaxed whitespace-pre-wrap">
                      {message.content || (isStreaming && i === currentMessages.length - 1 ? "…" : "")}
                    </div>
                  </div>
                </div>
              )
            )}
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
