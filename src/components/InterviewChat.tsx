"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Home, Check, Mic, MicOff, Volume2, VolumeX, Pause, Play, RotateCcw } from "lucide-react";
import {
  INTERVIEWER_ORDER,
  INTERVIEWER_META,
  INTERVIEWER_ICON,
  INTERVIEWER_ACCENT,
  type InterviewerRole,
} from "@/lib/interview/roles";
import type { InterviewReport } from "@/lib/interview/report";
import { isKickoffTurn, type ChatTurn, type HistoryByRole } from "@/lib/interview/transcript";
import { extractPdfText } from "@/lib/interview/extractPdf";
import { PdfExportSection } from "@/components/PdfExportSection";
import { PdfUploadStrip } from "@/components/PdfUploadStrip";
import { ReportCard } from "@/components/ReportCard";
import { InterviewTranscript } from "@/components/InterviewTranscript";

// 면접관마다 대화 히스토리를 따로 관리한다.
// (기술 면접관과 나눈 대화를 인성 면접관에게 그대로 넘기면 맥락이 뒤섞이므로 분리)
const EMPTY_HISTORY: HistoryByRole = {
  technical: [],
  personality: [],
  pressure: [],
};

export function InterviewChat({ userName }: { userName?: string | null }) {
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
  const [portfolioFileName, setPortfolioFileName] = useState("");
  const [portfolioFileText, setPortfolioFileText] = useState(""); // 포트폴리오는 선택 사항 — 비어있어도 됨
  const [isExtractingPortfolio, setIsExtractingPortfolio] = useState(false);
  const [portfolioUploadError, setPortfolioUploadError] = useState<string | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // 음성 입출력(STT/TTS) — 둘 다 브라우저 내장 Web Speech API라 서버/API 키가 필요 없다.
  // Chrome/Edge 계열만 안정적으로 지원해서, 지원 여부를 감지해 버튼 자체를 숨긴다(기능 저하가 아니라
  // 아예 안 보이게). SSR 시점엔 window가 없으므로 최초 렌더는 항상 false로 시작해서 하이드레이션
  // 불일치가 나지 않게 하고, 마운트 후 지원 여부를 다시 확인해 반영한다.
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(false);
  const [isListening, setIsListening] = useState(false); // 마이크로 답변을 받아쓰는 중인지
  const [sttError, setSttError] = useState<string | null>(null); // 권한 거부/네트워크 오류 등 원인을 보여준다
  // 면접관 질문을 음성으로 읽어줄지 — 기본 켜짐으로 변경(사용자 요청). 중간에 껐다 켜는
  // 전환 시점에 유독 재생이 안 되는 경우가 있었는데, 세션 시작부터 켜두면 그 전환 자체가
  // 없어져서 그 문제를 피해갈 수 있다.
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  // 지금 재생 중(또는 일시정지 중)인 메시지가 어떤 것인지 — 메시지별 다시 듣기 버튼이 "재생/
  // 일시정지/처음부터"를 올바르게 보여주려면 어떤 발화가 지금 것인지 알아야 한다. 자동 안내
  // (sendMessage 끝에서 호출)처럼 특정 메시지에 묶이지 않는 재생은 key 없이 호출되므로 여기 안 잡힌다.
  const [activeSpeechKey, setActiveSpeechKey] = useState<string | null>(null);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningBaseTextRef = useRef(""); // 녹음을 시작한 시점까지 이미 입력해둔 텍스트 — 그 뒤에 이어붙인다

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRole = INTERVIEWER_ORDER[interviewerIndex];
  const CurrentIcon = INTERVIEWER_ICON[currentRole];
  const currentAccent = INTERVIEWER_ACCENT[currentRole];
  const currentMessages = history[currentRole];

  // 수기 입력 + PDF에서 추출한 내용을 합쳐서 면접관에게 넘긴다. 사용자는 둘 중 하나만 채우면 된다.
  const combinedResumeContent = [resumeContent.trim(), resumeFileText.trim()].filter(Boolean).join("\n\n");

  // 지원 직무는 필수, 이력서는 PDF 업로드/텍스트 입력 중 최소 하나가 있어야 시작 가능
  // (직무·이력서 정보가 없으면 면접관이 두루뭉술한 질문만 하게 되고, 불필요한 토큰 낭비로 이어지기 쉽다)
  // 포트폴리오는 선택 사항이라 없어도 시작 가능하지만, 분석이 끝나기 전에 시작해버리면
  // 그 내용이 반영되지 않으므로 분석 중일 때는 다른 업로드와 마찬가지로 막는다.
  const canStart =
    jobRole.trim().length > 0 &&
    combinedResumeContent.length > 0 &&
    !isExtractingResume &&
    !isExtractingPortfolio;

  // 새 메시지가 추가될 때마다, 그리고 스트리밍이 끝나 "다음 면접관으로" 버튼이 나타날 때도
  // 대화창을 맨 아래로 스크롤해서 버튼이 가려지지 않게 한다.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [currentMessages, isStreaming]);

  // 브라우저의 음성 인식/음성 합성 지원 여부를 확인한다. effect 본문에서 setState를 바로
  // 동기 호출하면 react-hooks/set-state-in-effect에 걸리므로 microtask로 한 틱 미뤄서 호출한다.
  useEffect(() => {
    queueMicrotask(() => {
      setSpeechRecognitionSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
      setSpeechSynthesisSupported("speechSynthesis" in window);
    });
  }, []);

  // 화면을 벗어날 때 혹시 마이크가 켜져 있거나 음성이 재생 중이면 정리한다.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // 브라우저가 주는 음성 인식 에러 코드를 한글로 바꿔서 화면에 보여준다 — 이게 없으면
  // "마이크는 켜졌는데 아무 반응이 없다"는 상황에서 원인(권한/네트워크/무음)을 전혀 알 수 없다.
  function translateSpeechError(code: string): string {
    switch (code) {
      case "not-allowed":
      case "service-not-allowed":
        return "마이크 권한이 꺼져 있습니다. 브라우저 주소창 옆 권한 설정에서 허용해주세요.";
      case "no-speech":
        return "음성이 감지되지 않았습니다. 다시 시도해주세요.";
      case "audio-capture":
        return "마이크를 찾을 수 없습니다. 연결 상태를 확인해주세요.";
      case "network":
        return "네트워크 오류로 음성 인식에 실패했습니다. (인터넷 연결 또는 방화벽을 확인해주세요)";
      default:
        return `음성 인식 중 오류가 발생했습니다. (${code})`;
    }
  }

  // 마이크 버튼 — 누르면 녹음 시작/종료를 토글한다. 인식된 말은 실시간으로(중간 결과 포함)
  // 입력창에 반영된다. continuous를 켜두면 Chrome이 몇 초만 조용해도 세션 자체를 내부적으로
  // 끊어버려서(공식 스펙 동작은 아니고 Chrome 구현체 특성) 오히려 "듣고 있는 것처럼 보이는데
  // 실제로는 인식이 안 되는" 상황이 됐다. 한 번 말하면 자동으로 끝나는 기본 방식(continuous:
  // false)이 훨씬 단순하고 안정적이라 이쪽으로 되돌린다 — 답변이 길면 마이크를 다시 눌러 이어가면 됨.
  function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop(); // onend에서 isListening을 꺼준다
      return;
    }

    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    setSttError(null);
    listeningBaseTextRef.current = input; // 이미 입력해둔 내용은 지우지 않고 그 뒤에 이어붙인다
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "ko-KR";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          listeningBaseTextRef.current = `${listeningBaseTextRef.current}${transcript} `;
        } else {
          interimTranscript += transcript;
        }
      }
      setInput(listeningBaseTextRef.current + interimTranscript);
    };
    recognition.onerror = (event) => {
      // console.debug는 크롬 콘솔 기본 필터("Verbose" 꺼짐)에서 아예 안 보일 수 있어서
      // console.log/console.warn으로 남긴다 — 진단용 로그가 안 보이면 원인 파악 자체가 안 된다.
      // "no-speech"(말을 아예 안 함)와 "aborted"(사용자가 버튼으로 직접 멈춤)는 실패라기보다
      // 자연스러운 상황이라 화면에는 에러로 보여주지 않지만, 콘솔에는 남긴다.
      if (event.error === "no-speech" || event.error === "aborted") {
        console.log("[음성인식] 종료:", event.error);
        return;
      }
      console.error("음성 인식 오류:", event.error, event.message);
      setSttError(translateSpeechError(event.error));
    };
    recognition.onend = () => setIsListening(false); // 한 문장 인식이 끝나면(또는 무음 타임아웃) 자동으로 꺼진다
    // 아래 4개는 "듣고 있는 것처럼 보이는데 텍스트가 안 채워진다"는 문제가 마이크(오디오 캡처)
    // 단계 문제인지, 그 뒤 인식 엔진(네트워크) 단계 문제인지 구분하려고 남기는 진단용 로그다.
    // 예) onaudiostart조차 안 찍히면 브라우저가 마이크 자체를 못 받아온 것(OS 마이크 권한/장치
    // 문제일 가능성이 크고, onspeechstart는 찍히는데 결과가 없으면 인식 서버 통신 문제일 수 있다.
    recognition.onstart = () => console.log("[음성인식] 시작됨 (recognition.start() 호출 성공)");
    recognition.onaudiostart = () => console.log("[음성인식] 마이크 캡처 시작");
    recognition.onaudioend = () => console.log("[음성인식] 마이크 캡처 종료");
    recognition.onspeechstart = () => console.log("[음성인식] 말소리 감지됨");
    recognition.onspeechend = () => console.log("[음성인식] 말소리 끝남");

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      // start()는 이미 시작된 인스턴스를 다시 시작하려 할 때 등 특정 상황에서 동기적으로
      // 예외를 던질 수 있다 — 이걸 못 잡으면 아무 로그도 안 남고 조용히 멈춘 것처럼 보인다.
      console.error("[음성인식] start() 호출 실패:", err);
      setSttError("마이크를 시작하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해주세요.");
      return;
    }
    setIsListening(true);
  }

  // 면접관마다 목소리를 다르게 들리게 한다 — 실제 목소리(voice) 자체는 시스템/브라우저에 설치된
  // 한국어 음성 개수만큼만 서로 다르게 배정되고(하나만 있으면 셋 다 같은 voice를 쓰게 됨),
  // 그와 별개로 pitch/rate를 역할별로 다르게 둬서 voice가 하나뿐이어도 최소한 톤 차이는 나게 한다.
  // pitch는 스펙상 0~2(기본 1) 범위인데, 이전에 1.4/0.7 정도로는 사용자가 "다 똑같은 목소리"로
  // 느낄 만큼 체감 차이가 작았다 — 시스템에 로컬 한국어 목소리가 1개뿐이면 결국 pitch/rate 차이가
  // 유일한 구분 수단이라, 한계치에 가깝게 확 벌려서 확실히 다르게 들리도록 한다.
  const ROLE_VOICE_STYLE: Record<InterviewerRole, { pitch: number; rate: number }> = {
    technical: { pitch: 1, rate: 1 },
    personality: { pitch: 1.8, rate: 0.85 }, // 훨씬 높고 느긋하게
    pressure: { pitch: 0.5, rate: 1.25 }, // 훨씬 낮고 빠르게
  };

  function pickVoiceForRole(role: InterviewerRole): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) return null;
    const koreanVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("ko"));
    const candidates = koreanVoices.length > 0 ? koreanVoices : voices;
    // 크롬 목소리 목록엔 "Google 한국의"처럼 네트워크(원격 서버)로 합성하는 목소리가 끼어있는
    // 경우가 있는데, 이게 몇몇 크롬 버전/환경에서 에러도 없이 그냥 조용히 재생을 안 하는 경우가
    // 보고돼 있다 — 그래서 기기에 실제 설치된(localService) 목소리를 우선한다. (기술 면접관만
    // 유독 안 들리던 게, 항상 배열 0번 목소리를 쓰는데 그게 하필 네트워크 목소리였을 가능성이 큼)
    const localCandidates = candidates.filter((v) => v.localService);
    const pool = localCandidates.length > 0 ? localCandidates : candidates;
    return pool[INTERVIEWER_ORDER.indexOf(role) % pool.length];
  }

  // 면접관의 답변을 음성으로 읽어준다. 이전에 읽던 게 남아있으면 끊고 새로 읽는다.
  // 주의: Chrome은 cancel() 직후 바로 speak()를 호출하면 새 발화가 씹혀서 아예 소리가 안 나는
  // 버그가 있다 — 뭔가 말하고 있을 때만 cancel()하고, 그 다음 speak()는 한 틱 미뤄서 호출한다.
  // key를 넘기면(메시지별 다시 듣기 버튼에서 사용) activeSpeechKey/isSpeechPaused를 갱신해서
  // 그 버튼이 재생/일시정지 상태를 정확히 보여줄 수 있게 한다. 자동 안내 호출은 key 없이 부른다.
  function speak(text: string, role: InterviewerRole, key?: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) return;
    const synth = window.speechSynthesis;

    function doSpeak() {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      const voice = pickVoiceForRole(role);
      if (voice) utterance.voice = voice;
      utterance.pitch = ROLE_VOICE_STYLE[role].pitch;
      utterance.rate = ROLE_VOICE_STYLE[role].rate;
      // 어떤 목소리가 배정됐는지, 실제로 재생이 "시작"됐는지까지 남겨서 특정 면접관만 안 들리는
      // 문제가 목소리 자체(network voice 등) 때문인지 확인할 수 있게 한다.
      console.log(
        `[음성합성] ${role} 역할에 배정된 목소리:`,
        voice ? `${voice.name} (${voice.lang}, ${voice.localService ? "로컬" : "네트워크"})` : "(없음 — 브라우저 기본값 사용)"
      );
      if (key) {
        utterance.onstart = () => {
          setActiveSpeechKey(key);
          setIsSpeechPaused(false);
        };
        utterance.onpause = () => setIsSpeechPaused(true);
        utterance.onresume = () => setIsSpeechPaused(false);
        utterance.onend = () => setActiveSpeechKey((cur) => (cur === key ? null : cur));
      }
      utterance.onerror = (event) => {
        if (key) setActiveSpeechKey((cur) => (cur === key ? null : cur));
        // "interrupted"는 다음 발화를 재생하려고 우리가 직접 cancel()해서 생기는 정상적인
        // 부작용이라 에러가 아니다 — 그 외의 경우만 실제 실패로 보고 로그를 남긴다.
        if (event.error !== "interrupted" && event.error !== "canceled") {
          console.error(`[음성합성] ${role} 재생 오류:`, event.error);
        }
      };
      synth.speak(utterance);
    }

    // 일부 브라우저는 페이지 로드 직후엔 목소리 목록이 비어 있다가 뒤늦게(비동기로) 채워진다.
    // 문제는 "voiceschanged"가 우리가 리스너를 달기도 전에 이미 한 번 발생해버렸을 수도 있다는
    // 것 — 그러면 이 리스너는 영원히 다시 안 불려서 첫 재생 시도가 통째로 조용히 멈춰버린다
    // (실제로 "기술 면접관 첫 질문은 안 들리는데, 다음 면접관부턴 잘 들린다"는 증상으로 나타남 —
    // 그때쯤엔 이미 목소리 목록이 채워져 있어 정상 경로를 타기 때문). 그래서 이벤트를 무한정
    // 기다리지 않고, 짧게(300ms)만 기다렸다가 그래도 안 채워지면 목소리 없이라도 재생을 시도한다.
    function speakWhenVoicesReady() {
      if (synth.getVoices().length > 0) {
        doSpeak();
        return;
      }
      let alreadySpoken = false;
      const onVoicesChanged = () => {
        if (alreadySpoken) return;
        alreadySpoken = true;
        doSpeak();
      };
      synth.addEventListener("voiceschanged", onVoicesChanged, { once: true });
      setTimeout(() => {
        if (alreadySpoken) return;
        alreadySpoken = true;
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        doSpeak();
      }, 300);
    }

    if (synth.speaking || synth.pending) {
      synth.cancel();
      setTimeout(speakWhenVoicesReady, 50);
    } else {
      speakWhenVoicesReady();
    }
  }

  function toggleTts() {
    setIsTtsEnabled((prev) => {
      if (prev) window.speechSynthesis?.cancel(); // 끄는 순간 읽던 것도 바로 멈춘다
      return !prev;
    });
  }

  // Claude 스트리밍 응답(SSE)을 받아 현재 면접관의 대화 기록에 실시간으로 반영한다.
  async function sendMessage(role: InterviewerRole, messages: ChatTurn[]) {
    setIsStreaming(true);

    const response = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // jobRole/resumeContent/portfolioContent는 세션이 처음 만들어질 때만 서버에서 사용되고, 이후 요청에선 무시된다.
      body: JSON.stringify({
        sessionId,
        interviewerRole: role,
        messages,
        jobRole,
        resumeContent: combinedResumeContent,
        portfolioContent: portfolioFileText.trim(),
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
    let finalContent = ""; // TTS용으로 스트리밍 중인 답변 전체를 따로 모아둔다

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
          finalContent += payload.text;
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
    if (isTtsEnabled) speak(finalContent, role); // 답변이 다 끊긴 뒤 한 번에 읽어준다 (토큰마다 끊어 읽으면 부자연스러움)
  }

  // 이력서 PDF를 업로드하면 Claude가 직접 내용을 읽어 텍스트로 옮기고, 그 결과를 기억해둔다.
  // 별도 OCR 라이브러리 없이 Claude의 문서(document) 입력 기능을 그대로 사용한다.
  async function handleResumeFileChange(file: File) {
    setResumeUploadError(null);
    setResumeFileName(file.name);
    setIsExtractingResume(true);
    try {
      setResumeFileText(await extractPdfText(file, "resume")); // 텍스트박스(resumeContent)에는 넣지 않고 별도로 기억만 해둔다
    } catch (error) {
      setResumeUploadError(error instanceof Error ? error.message : "이력서 분석 중 오류가 발생했습니다.");
    } finally {
      setIsExtractingResume(false);
    }
  }

  // 포트폴리오 PDF 업로드 — 이력서와 같은 방식(Claude 문서 입력)으로 처리하되 선택 사항이다.
  async function handlePortfolioFileChange(file: File) {
    setPortfolioUploadError(null);
    setPortfolioFileName(file.name);
    setIsExtractingPortfolio(true);
    try {
      setPortfolioFileText(await extractPdfText(file, "portfolio"));
    } catch (error) {
      setPortfolioUploadError(error instanceof Error ? error.message : "포트폴리오 분석 중 오류가 발생했습니다.");
    } finally {
      setIsExtractingPortfolio(false);
    }
  }

  // 지원 직무/이력서/포트폴리오가 첫 질문에 반영되도록 트리거 메시지에 같이 담는다.
  // (직무·이력서는 시작 전 필수 입력이라 항상 존재하고, 포트폴리오는 선택이라 없으면 그냥 생략된다)
  function buildKickoffMessage(): string {
    const context = [
      `지원 직무: ${jobRole.trim()}`,
      `이력서/경력 요약: ${combinedResumeContent}`,
      portfolioFileText.trim() && `포트폴리오 내용: ${portfolioFileText.trim()}`,
    ]
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
    if (!canStart) return; // 버튼이 disabled되어 있어 보통은 여기 도달하지 않지만 방어적으로 한 번 더 확인
    setStarted(true);
    startInterviewer(currentRole);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || isStreaming) return;
    if (isListening) recognitionRef.current?.stop(); // 답변을 보내면서 마이크가 켜져 있으면 같이 꺼준다

    const userTurn: ChatTurn = { role: "user", content: input.trim() };
    const nextMessages = [...currentMessages, userTurn];

    setHistory((prev) => ({ ...prev, [currentRole]: nextMessages }));
    setInput("");
    void sendMessage(currentRole, nextMessages);
  }

  function handleNextInterviewer() {
    // 이전 면접관 답변이 아직 음성으로 재생 중이면 여기서 바로 끊는다 — 안 그러면 다음 면접관의
    // 질문이 나오기 전까지(스트리밍이 끝날 때까지) 이전 목소리가 계속 흘러나오게 된다.
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();

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
    recognitionRef.current?.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
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
    setPortfolioFileName("");
    setPortfolioFileText("");
    setPortfolioUploadError(null);
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
          {/* 회원가입 시 입력한 이름으로 인사 — 이름이 없는(과거 가입) 계정은 조용히 생략한다 */}
          {userName && <p className="text-sm font-medium text-muted md:text-base">안녕하세요, {userName}님</p>}
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

        {/* 지원 직무는 필수, 이력서는 PDF 업로드/텍스트 입력 중 하나가 필수 — 정보 없이 시작하면 면접관이
            두루뭉술한 질문만 반복하게 되어 토큰만 낭비하게 되므로 시작 전에 반드시 받아둔다. */}
        <div className="glass-card flex w-full max-w-2xl flex-col gap-3 rounded-xl p-4 text-left md:p-5">
          <div className="flex flex-col gap-1">
            <label htmlFor="jobRole" className="text-xs font-medium text-muted">
              지원 직무 (필수)
            </label>
            <input
              id="jobRole"
              type="text"
              required
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              placeholder="예: 프론트엔드 개발자"
              className="rounded-xl border border-border bg-white/6 px-4 py-2 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="resumeContent" className="text-xs font-medium text-muted">
              이력서 / 경력 (필수 — PDF 업로드 또는 아래 직접 입력 중 하나)
            </label>

            {/* PDF 업로드 — 텍스트박스와는 별개. 내용을 화면에 보여주지 않고 면접관이 "기억"만 하게 한다. */}
            <PdfUploadStrip
              inputId="resumeFile"
              idleText="PDF 이력서를 업로드하거나, 아래에 직접 입력해주세요"
              successText={`✅ ${resumeFileName} 분석 완료 — 면접관이 참고합니다`}
              isExtracting={isExtractingResume}
              hasResult={Boolean(resumeFileText)}
              error={resumeUploadError}
              onFileSelected={(file) => void handleResumeFileChange(file)}
            />

            {/* 직접 입력 — PDF 업로드와 무관하게 순수 수기 입력용 */}
            <textarea
              id="resumeContent"
              value={resumeContent}
              onChange={(e) => setResumeContent(e.target.value)}
              rows={4}
              placeholder="최근 프로젝트, 주요 기술 스택 등을 직접 적어주세요 (또는 위에서 PDF 업로드)"
              className="resize-none rounded-xl border border-border bg-white/6 px-4 py-2 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted">포트폴리오 (선택)</label>
            <PdfUploadStrip
              inputId="portfolioFile"
              idleText="포트폴리오 PDF가 있다면 업로드해보세요 (면접관이 프로젝트를 참고해서 질문합니다)"
              successText={`✅ ${portfolioFileName} 분석 완료 — 면접관이 참고합니다`}
              isExtracting={isExtractingPortfolio}
              hasResult={Boolean(portfolioFileText)}
              error={portfolioUploadError}
              onFileSelected={(file) => void handlePortfolioFileChange(file)}
            />
          </div>
        </div>

        <div className="flex w-full max-w-sm flex-col items-center gap-2 md:max-w-none">
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="w-full max-w-sm rounded-xl bg-linear-to-r from-orange-500 to-amber-500 px-6 py-3 font-medium text-white shadow-lg shadow-orange-500/25 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 md:w-auto"
          >
            {isExtractingResume
              ? "이력서 분석 중..."
              : isExtractingPortfolio
                ? "포트폴리오 분석 중..."
                : "시작하기"}
          </button>
          {!canStart && !isExtractingResume && !isExtractingPortfolio && (
            <p className="text-xs text-muted">지원 직무와 이력서(PDF 또는 직접 입력)를 모두 입력해야 시작할 수 있습니다.</p>
          )}
        </div>
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

        {/* 날짜/직무 헤더 + 다운로드 버튼(우측 상단 고정) + 리포트 + 대화 전문을
            PdfExportSection이 하나의 캡처 영역으로 묶는다. */}
        {report && (
          <PdfExportSection
            fileName={`오늘의면접관_${jobRole.trim().replace(/[\\/:*?"<>|]/g, "_")}_리포트.pdf`}
            header={
              <div>
                <p className="text-xs text-muted">
                  {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <h1 className="text-xl font-bold">{jobRole.trim() || "직무 미입력"}</h1>
              </div>
            }
            report={<ReportCard report={report} />}
            transcript={<InterviewTranscript history={history} />}
          />
        )}

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
      {/* 진행 상태 표시: 스텝 프로그레스 바 — 완료/현재/대기 상태를 원과 연결선으로 표현.
          모바일에서도 면접관 이름을 그대로 보여준다(글자만 살짝 작게) */}
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
                {/* 모바일에서도 이름을 그대로 보여준다 — 글자 크기만 살짝 줄여서 좁은 화면에 맞춘다 */}
                <span
                  className={`text-[10px] whitespace-nowrap md:text-xs ${
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
        <div className="min-w-0 flex-1">
          <p className="font-medium">{INTERVIEWER_META[currentRole].label}</p>
          <p className="truncate text-xs text-muted">{INTERVIEWER_META[currentRole].description}</p>
        </div>
        {/* 면접관 질문을 음성으로 읽어줄지 토글 — 기본은 꺼짐(브라우저 자동재생 정책상 사용자가
            직접 눌러야 이후 재생이 안정적으로 동작하기도 하고, 갑자기 소리가 나면 당황스러우니까) */}
        {speechSynthesisSupported && (
          <button
            type="button"
            onClick={toggleTts}
            aria-label={isTtsEnabled ? "음성 안내 끄기" : "음성 안내 켜기"}
            title={isTtsEnabled ? "음성 안내 끄기" : "면접관 질문을 음성으로 듣기"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
              isTtsEnabled ? `${currentAccent.softBg} ${currentAccent.text}` : "text-muted hover:bg-border hover:text-foreground"
            }`}
          >
            {isTtsEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* 대화 목록 — "다음 면접관으로" 버튼도 이 스크롤 영역 안(대화 마지막)에 같이 둔다.
          예전엔 이 버튼을 스크롤 영역과 입력창 사이의 별도 줄로 뒀는데, 그러면 버튼이 나타나고
          사라질 때마다 입력창 높이 배분이 바뀌면서 입력창 위치가 위아래로 흔들려 보였다.
          버튼을 스크롤 영역 안으로 옮기면 입력창은 항상 화면 맨 아래 같은 자리에 고정된다. */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 md:px-4 md:py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {currentMessages
            .filter((m) => !isKickoffTurn(m)) // 트리거 메시지는 화면에서 숨김
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
                    {/* 메시지 하나하나를 다시 들어볼 수 있는 버튼 — 자동 안내(토글)와 별개로,
                        스트리밍이 끝난 메시지에만 보여준다. 재생 중인 메시지는 일시정지/재개
                        버튼과 처음부터 다시 듣기 버튼 두 개를, 그 외에는 재생 버튼 하나만 보여준다. */}
                    {speechSynthesisSupported &&
                      message.content &&
                      !(isStreaming && i === currentMessages.length - 1) &&
                      (() => {
                        const speechKey = `${currentRole}-${i}`;
                        const isActive = activeSpeechKey === speechKey;
                        return isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => (isSpeechPaused ? window.speechSynthesis.resume() : window.speechSynthesis.pause())}
                              aria-label={isSpeechPaused ? "재생" : "일시정지"}
                              title={isSpeechPaused ? "재생" : "일시정지"}
                              className="text-accent transition-colors hover:opacity-80"
                            >
                              {isSpeechPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => speak(message.content, currentRole, speechKey)}
                              aria-label="처음부터 다시 듣기"
                              title="처음부터 다시 듣기"
                              className="text-muted transition-colors hover:text-accent"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => speak(message.content, currentRole, speechKey)}
                            aria-label="이 답변 다시 듣기"
                            title="다시 듣기"
                            className="text-muted transition-colors hover:text-accent"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        );
                      })()}
                  </span>
                  <div className="glass-card rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap">
                    {message.content || (isStreaming && i === currentMessages.length - 1 ? "…" : "")}
                  </div>
                </div>
              )
            )}

          {/* 다음 면접관으로 넘어가기 (스트리밍이 끝난 뒤에만 노출) — hover 시 다음 면접관의 포인트 컬러로 채워진다 */}
          {!isStreaming && currentMessages.length > 1 && (
            <div className="flex justify-center pt-2">
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
        </div>
      </div>

      {/* 답변 입력창 — 화면 하단에 고정되는 느낌을 주는 프로스티드 바 */}
      <form onSubmit={handleSubmit} className="border-t border-border bg-surface/80 p-3 backdrop-blur md:p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-1.5">
          {sttError && <p className="text-xs text-red-400">🎤 {sttError}</p>}
          <div className="flex items-end gap-2">
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
            {/* 마이크로 답변 받아쓰기 — 지원하는 브라우저(Chrome/Edge)에서만 보여준다.
                녹음 중에는 빨간색으로 은은하게 깜빡여서 지금 듣고 있다는 걸 알려준다. */}
            {speechRecognitionSupported && (
              <button
                type="button"
                onClick={toggleListening}
                aria-label={isListening ? "음성 입력 중지" : "음성으로 답변 입력"}
                title={isListening ? "음성 입력 중지" : "마이크로 답변 입력"}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  isListening
                    ? "animate-pulse border-red-400/40 bg-red-400/10 text-red-400"
                    : "border-border text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              aria-label="답변 전송"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
