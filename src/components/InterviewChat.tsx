"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Home, Check } from "lucide-react";
import {
  INTERVIEWER_ORDER,
  INTERVIEWER_META,
  INTERVIEWER_ICON,
  INTERVIEWER_ACCENT,
  type InterviewerRole,
} from "@/lib/interview/roles";
import type { InterviewReport } from "@/lib/interview/report";
import { ReportCard } from "@/components/ReportCard";

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
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [interviewerIndex, setInterviewerIndex] = useState(0);
  const [history, setHistory] = useState<HistoryByRole>(EMPTY_HISTORY);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [finished, setFinished] = useState(false);
  const [jobRole, setJobRole] = useState("");
  const [resumeContent, setResumeContent] = useState(""); // 텍스트박스 수기 입력 (PDF와 무관하게 별개로 유지)
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileText, setResumeFileText] = useState(""); // PDF에서 추출한 내용 — 화면에 노출하지 않고 기억만 해둠
  const [isExtractingResume, setIsExtractingResume] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRole = INTERVIEWER_ORDER[interviewerIndex];
  const CurrentIcon = INTERVIEWER_ICON[currentRole];
  const currentAccent = INTERVIEWER_ACCENT[currentRole];
  const currentMessages = history[currentRole];

  // 수기 입력 + PDF에서 추출한 내용을 합쳐서 면접관에게 넘긴다. 둘 다 선택 사항이라 둘 다 비어있을 수도 있다.
  const combinedResumeContent = [resumeContent.trim(), resumeFileText.trim()].filter(Boolean).join("\n\n");

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
      // jobRole/resumeContent는 세션이 처음 만들어질 때만 서버에서 사용되고, 이후 요청에선 무시된다.
      body: JSON.stringify({
        sessionId,
        interviewerRole: role,
        messages,
        jobRole,
        resumeContent: combinedResumeContent,
      }),
    });

    // 세션 생성 등 스트리밍이 시작되기도 전에 서버가 실패하면(예: DB 오류) 일반 JSON 에러가 온다.
    // 이 경우를 놓치면 화면이 조용히 멈춘 것처럼 보이므로 에러 메시지를 채팅창에 직접 띄운다.
    if (!response.ok || !response.body) {
      let message = "요청 처리 중 오류가 발생했습니다.";
      try {
        const data = (await response.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // 응답이 JSON이 아니면 기본 메시지를 그대로 사용
      }
      setHistory((prev) => ({
        ...prev,
        [role]: [...prev[role], { role: "assistant", content: `⚠️ ${message}` }],
      }));
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

        // 스트리밍 도중 발생한 에러(예: Claude API 실패)도 화면에 바로 보이게 한다.
        if (payload.error) {
          setHistory((prev) => {
            const updated = [...prev[role]];
            const last = updated[updated.length - 1];
            const prefix = last.content ? `${last.content}\n\n` : "";
            updated[updated.length - 1] = { ...last, content: `${prefix}⚠️ ${payload.error}` };
            return { ...prev, [role]: updated };
          });
        }
      }
    }

    setIsStreaming(false);
  }

  // PDF 파일을 base64 문자열로 변환한다 (data: 접두사는 잘라낸다).
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
  }

  // 이력서 PDF를 업로드하면 Claude가 직접 내용을 읽어 요약하고, 그 결과로 "이력서/경력 요약" 칸을 채운다.
  // 별도 OCR 라이브러리 없이 Claude의 문서(document) 입력 기능을 그대로 사용한다.
  async function handleResumeFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일을 다시 선택해도 onChange가 발생하도록 초기화
    if (!file) return;

    setResumeUploadError(null);

    if (file.type !== "application/pdf") {
      setResumeUploadError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setResumeUploadError("파일이 너무 큽니다 (10MB 이하).");
      return;
    }

    setResumeFileName(file.name);
    setIsExtractingResume(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const response = await fetch("/api/interview/extract-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64 }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "이력서 분석에 실패했습니다.");
      }
      const data = (await response.json()) as { content: string };
      setResumeFileText(data.content); // 텍스트박스(resumeContent)에는 넣지 않고 별도로 기억만 해둔다
    } catch (error) {
      setResumeUploadError(error instanceof Error ? error.message : "이력서 분석 중 오류가 발생했습니다.");
    } finally {
      setIsExtractingResume(false);
    }
  }

  // 지원 직무/이력서 요약이 입력되어 있으면 첫 질문에 반영되도록 트리거 메시지에 같이 담는다.
  function buildKickoffMessage(): string {
    const job = jobRole.trim();
    const resume = combinedResumeContent;
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
    setResumeContent("");
    setResumeFileName("");
    setResumeFileText("");
    setResumeUploadError(null);
    setReport(null);
    setReportError(null);
  }

  // 세 면접관과의 전체 대화(history)를 Claude에게 보내 종합 평가 리포트를 받아온다.
  // "면접 마치기" 클릭 시점(handleNextInterviewer)에서 직접 호출한다.
  // 서버가 sessionId 기준으로 DB에 리포트를 저장하므로, 저장이 끝나면 router.refresh()로
  // 좌측 사이드바(서버 컴포넌트)가 새 기록을 바로 반영하도록 한다.
  async function generateReport() {
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const response = await fetch("/api/interview/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, history }),
      });
      if (!response.ok) throw new Error("리포트 요청 실패");
      setReport((await response.json()) as InterviewReport);
      router.refresh();
    } catch {
      setReportError("리포트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  if (!started) {
    return (
      <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-8 text-center md:gap-8 md:px-6 md:py-12">
        <div className="flex flex-col items-center gap-3">
          <h1 className="max-w-md bg-linear-to-r from-orange-400 to-amber-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl lg:text-5xl">
            오늘의 면접관
          </h1>
          <p className="max-w-sm text-sm text-muted md:text-base">기술을 묻고, 사람을 보고, 압박을 견딘다.</p>
        </div>

        {/* 면접관 3인 미리보기 — 순차 fade-in으로 등장. 모바일에서는 아이콘+텍스트를 가로로, md 이상에서는 세로로 배치 */}
        <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          {INTERVIEWER_ORDER.map((role, i) => {
            const Icon = INTERVIEWER_ICON[role];
            const accent = INTERVIEWER_ACCENT[role];
            return (
              <div
                key={role}
                style={{ animationDelay: `${i * 100}ms` }}
                className={`glass-card animate-fade-in-up flex flex-row items-center gap-3 rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] md:flex-col md:items-center md:gap-2 md:p-5 md:text-center ${accent.hoverBorder} ${accent.hoverGlow}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent.softBg}`}>
                  <Icon className={`h-5 w-5 ${accent.text}`} />
                </span>
                <div className="md:contents">
                  <p className="text-sm font-semibold">{INTERVIEWER_META[role].label}</p>
                  <p className="text-xs leading-relaxed text-muted">{INTERVIEWER_META[role].description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* 지원 직무/이력서 요약 — 입력하면 첫 질문에 반영됨, 둘 다 선택 사항 */}
        <div className="glass-card flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4 text-left md:p-5">
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
              className="rounded-xl border border-border bg-white/6 px-4 py-2 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="resumeContent" className="text-xs font-medium text-muted">
              이력서 / 경력 (선택)
            </label>

            {/* PDF 업로드 — 텍스트박스와는 별개. 내용을 화면에 보여주지 않고 면접관이 "기억"만 하게 한다. */}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5">
              <span className="flex-1 truncate text-xs text-muted">
                {isExtractingResume
                  ? "PDF를 읽고 있습니다..."
                  : resumeFileText
                    ? `✅ ${resumeFileName} 분석 완료 — 면접관이 참고합니다`
                    : "PDF 이력서가 있다면 업로드해보세요 (면접관이 내용을 기억하고 질문합니다)"}
              </span>
              <label
                htmlFor="resumeFile"
                className={`shrink-0 cursor-pointer rounded-lg border px-3 py-1 text-xs transition-colors ${
                  isExtractingResume
                    ? "cursor-not-allowed border-border text-muted"
                    : "border-accent/40 text-accent hover:bg-accent/10"
                }`}
              >
                PDF 선택
              </label>
              <input
                id="resumeFile"
                type="file"
                accept="application/pdf"
                onChange={handleResumeFileChange}
                disabled={isExtractingResume}
                className="hidden"
              />
            </div>
            {resumeUploadError && <p className="text-xs text-red-500">{resumeUploadError}</p>}

            {/* 직접 입력 — PDF 업로드와 무관하게 순수 수기 입력용 */}
            <textarea
              id="resumeContent"
              value={resumeContent}
              onChange={(e) => setResumeContent(e.target.value)}
              rows={4}
              placeholder="최근 프로젝트, 주요 기술 스택 등을 직접 적어주세요 (선택)"
              className="resize-none rounded-xl border border-border bg-white/6 px-4 py-2 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleStart}
          disabled={isExtractingResume}
          className="w-full max-w-sm rounded-xl bg-linear-to-r from-orange-500 to-amber-500 px-6 py-3 font-medium text-white shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 md:w-auto"
        >
          {isExtractingResume ? "이력서 분석 중..." : "시작하기"}
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-6 overflow-y-auto px-4 py-8 text-center md:px-6 md:py-10">
        <p className="text-2xl font-bold">면접 종료</p>
        <p className="text-muted">세 사람과의 대화를 모두 마쳤습니다. 수고하셨습니다.</p>

        {isGeneratingReport && <p className="text-sm text-muted">평가 리포트를 만드는 중...</p>}
        {reportError && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-500">{reportError}</p>
            <button
              type="button"
              onClick={() => void generateReport()}
              className="rounded-lg border border-border px-3 py-1 text-xs text-muted hover:border-accent hover:text-accent"
            >
              다시 시도
            </button>
          </div>
        )}

        {report && <ReportCard report={report} />}

        <button
          type="button"
          onClick={handleRestart}
          className="flex items-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02]"
        >
          <Home className="h-4 w-4" /> 홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 진행 상태 표시: 스텝 프로그레스 바 — 완료/현재/대기 상태를 원과 연결선으로 표현
          모바일에서는 라벨 텍스트를 숨기고 아이콘 + 순번만 보여준다 */}
      <div className="flex items-center justify-center border-b border-border px-2 py-4 md:px-4 md:py-5">
        {INTERVIEWER_ORDER.map((role, i) => {
          const Icon = INTERVIEWER_ICON[role];
          const accent = INTERVIEWER_ACCENT[role];
          const done = i < interviewerIndex;
          const current = i === interviewerIndex;
          return (
            <div key={role} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? `${accent.border} ${accent.bg} text-white`
                      : current
                        ? `${accent.border} bg-transparent ${accent.text}`
                        : "border-neutral-600 text-neutral-600"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                {/* 모바일: 순번만 표시 */}
                <span
                  className={`text-xs font-semibold md:hidden ${
                    current ? accent.text : done ? "text-muted" : "text-neutral-600"
                  }`}
                >
                  {i + 1}
                </span>
                {/* md 이상: 전체 라벨 표시 */}
                <span
                  className={`hidden text-xs whitespace-nowrap md:inline ${
                    current ? `font-semibold ${accent.text}` : done ? "text-muted" : "text-neutral-600"
                  }`}
                >
                  {INTERVIEWER_META[role].label}
                </span>
              </div>
              {i < INTERVIEWER_ORDER.length - 1 && (
                <span
                  className={`mx-1.5 mb-5 w-5 border-t-2 sm:w-8 md:mx-2 md:w-16 ${
                    i < interviewerIndex ? `${accent.border} border-solid` : "border-dashed border-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 현재 대화 중인 면접관 프로필 헤더 — 역할별 포인트 컬러로 은은한 광원 효과를 얹는다 */}
      <div className={`role-glow-${currentRole} flex items-center gap-3 border-b border-border px-3 py-3 md:px-4`}>
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-surface ${currentAccent.softBorder} ${currentAccent.glow}`}
        >
          <CurrentIcon className={`h-5 w-5 ${currentAccent.text}`} />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{INTERVIEWER_META[currentRole].label}</p>
          <p className="truncate text-xs text-muted">{INTERVIEWER_META[currentRole].description}</p>
        </div>
      </div>

      {/* 대화 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {currentMessages
            .filter((m, i) => !(i === 0 && m.content.startsWith("면접을 시작해주세요"))) // 트리거 메시지는 화면에서 숨김
            .map((message, i) =>
              message.role === "user" ? (
                <div
                  key={i}
                  className="max-w-[85%] self-end rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 leading-relaxed whitespace-pre-wrap"
                >
                  {message.content}
                </div>
              ) : (
                <div key={i} className="flex max-w-[85%] flex-col gap-1 self-start">
                  {/* 면접관 아바타 + 이름 레이블 — 역할별 아이콘/포인트 컬러로 구분 */}
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full ${currentAccent.softBg}`}>
                      <CurrentIcon className={`h-3 w-3 ${currentAccent.text}`} />
                    </span>
                    {INTERVIEWER_META[currentRole].label}
                  </span>
                  <div className="glass-card rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap">
                    {message.content || (isStreaming && i === currentMessages.length - 1 ? "…" : "")}
                  </div>
                </div>
              )
            )}
        </div>
      </div>

      {/* 다음 면접관으로 넘어가기 (스트리밍이 끝난 뒤에만 노출) — hover 시 다음 면접관의 포인트 컬러로 채워진다 */}
      {!isStreaming && currentMessages.length > 1 && (
        <div className="flex justify-center border-t border-border px-3 py-3 md:px-4">
          {(() => {
            const isLast = interviewerIndex + 1 >= INTERVIEWER_ORDER.length;
            const nextAccent = isLast ? null : INTERVIEWER_ACCENT[INTERVIEWER_ORDER[interviewerIndex + 1]];
            return (
              <button
                type="button"
                onClick={handleNextInterviewer}
                className={`rounded-xl border px-5 py-2 text-sm font-medium transition-colors ${
                  nextAccent
                    ? `${nextAccent.softBorder} ${nextAccent.text} ${nextAccent.hoverBg} hover:border-transparent hover:text-white`
                    : "border-accent/40 text-accent hover:bg-accent hover:text-white"
                }`}
              >
                {isLast
                  ? "면접 마치기"
                  : `다음 면접관(${INTERVIEWER_META[INTERVIEWER_ORDER[interviewerIndex + 1]].label})으로`}
              </button>
            );
          })()}
        </div>
      )}

      {/* 답변 입력창 — 화면 하단에 고정되는 느낌을 주는 프로스티드 바 */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-surface/80 p-3 backdrop-blur md:p-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="답변을 입력하세요..."
            rows={2}
            className="min-w-0 flex-1 resize-none rounded-xl border border-border bg-white/6 px-3 py-2 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20 md:px-4"
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
            aria-label="답변 전송"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
