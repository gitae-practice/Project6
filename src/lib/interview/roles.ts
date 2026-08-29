// 면접관 역할 정의.
// 세 명의 면접관이 정해진 순서(INTERVIEWER_ORDER)대로 등장하며,
// 각자 다른 system prompt로 Claude를 호출해 성격이 다른 질문을 던진다.

import { Code2, Heart, Zap, type LucideIcon } from "lucide-react";

export type InterviewerRole = "technical" | "personality" | "pressure";

export interface InterviewerMeta {
  role: InterviewerRole;
  label: string; // 화면에 표시할 이름
  description: string; // 짧은 소개
}

// 면접이 진행되는 순서
export const INTERVIEWER_ORDER: InterviewerRole[] = [
  "technical",
  "personality",
  "pressure",
];

export const INTERVIEWER_META: Record<InterviewerRole, InterviewerMeta> = {
  technical: {
    role: "technical",
    label: "기술 면접관",
    description: "프로젝트 경험과 기술 선택의 근거를 파고듭니다",
  },
  personality: {
    role: "personality",
    label: "인성 면접관",
    description: "협업 경험과 갈등 상황 대처를 확인합니다",
  },
  pressure: {
    role: "pressure",
    label: "압박 면접관",
    description: "답변의 허점을 파고드는 후속 질문을 던집니다",
  },
};

// 역할별 아이콘 — 화면 전체(홈 미리보기 카드/진행 상태 표시/채팅 아바타/리포트)에서 공통으로 쓴다.
export const INTERVIEWER_ICON: Record<InterviewerRole, LucideIcon> = {
  technical: Code2,
  personality: Heart,
  pressure: Zap,
};

// 역할별 포인트 컬러 — 기술=blue, 인성=green, 압박=red로 구분해 어느 면접관인지 한눈에 보이게 한다.
// className 조각을 미리 묶어두어 각 컴포넌트에서 중복 정의하지 않고 재사용한다.
// 주의: Tailwind는 소스 코드에 "글자 그대로" 등장하는 클래스만 CSS로 생성한다.
// `hover:${accent.bg}`처럼 접두사와 변수를 런타임에 이어붙이면 완성된 문자열이
// 어떤 파일에도 그대로 존재하지 않아 스타일이 아예 만들어지지 않는다.
// 그래서 hover: 같은 variant가 붙는 조합은 아래처럼 완성된 문자열을 미리 다 적어둔다.
export interface InterviewerAccent {
  text: string; // 아이콘/포인트 텍스트 색
  border: string; // 진한 테두리 (강조용)
  bg: string; // 채워진 배경 (완료 표시 등)
  softBorder: string; // 옅은 테두리 (hover 등)
  softBg: string; // 옅은 배경
  glow: string; // 은은한 글로우 그림자
  hoverBg: string; // hover 시 배경을 해당 색으로 채움 ("다음 면접관으로" 버튼 등)
  hoverBorder: string; // hover 시 옅은 테두리로 강조 (미리보기 카드 등)
  hoverGlow: string; // hover 시 은은한 글로우 그림자
}

export const INTERVIEWER_ACCENT: Record<InterviewerRole, InterviewerAccent> = {
  technical: {
    text: "text-blue-400",
    border: "border-blue-400",
    bg: "bg-blue-400",
    softBorder: "border-blue-400/30",
    softBg: "bg-blue-400/10",
    glow: "shadow-[0_0_20px_rgba(96,165,250,0.3)]",
    hoverBg: "hover:bg-blue-400",
    hoverBorder: "hover:border-blue-400/30",
    hoverGlow: "hover:shadow-[0_0_20px_rgba(96,165,250,0.1)]",
  },
  personality: {
    text: "text-green-400",
    border: "border-green-400",
    bg: "bg-green-400",
    softBorder: "border-green-400/30",
    softBg: "bg-green-400/10",
    glow: "shadow-[0_0_20px_rgba(74,222,128,0.3)]",
    hoverBg: "hover:bg-green-400",
    hoverBorder: "hover:border-green-400/30",
    hoverGlow: "hover:shadow-[0_0_20px_rgba(74,222,128,0.1)]",
  },
  pressure: {
    text: "text-red-400",
    border: "border-red-400",
    bg: "bg-red-400",
    softBorder: "border-red-400/30",
    softBg: "bg-red-400/10",
    glow: "shadow-[0_0_20px_rgba(248,113,113,0.3)]",
    hoverBg: "hover:bg-red-400",
    hoverBorder: "hover:border-red-400/30",
    hoverGlow: "hover:shadow-[0_0_20px_rgba(248,113,113,0.1)]",
  },
};

// 역할별 system prompt. Claude에게 역할극을 시키는 핵심 지시문.
export const SYSTEM_PROMPTS: Record<InterviewerRole, string> = {
  technical: `당신은 프론트엔드/풀스택 개발자 채용 면접의 기술 면접관입니다.
지원자의 프로젝트 경험을 바탕으로 기술 선택의 이유, 트레이드오프, 문제 해결 과정을 파고드는 꼬리질문을 던지세요.
한 번에 하나의 질문만 하고, 답변이 피상적이면 더 구체적인 근거를 요구하세요.
답변마다 짧은 피드백 한 줄을 덧붙인 뒤 다음 질문으로 넘어가세요.`,

  personality: `당신은 채용 면접의 인성 면접관입니다.
협업 경험, 갈등 상황 대처, 팀워크에 대해 질문하세요.
답변에 구체적인 사례(상황-과제-행동-결과)가 빠져 있으면 보완 질문을 하세요.
지원자를 안심시키되, 뭉뚱그린 답변은 짚고 넘어가세요.`,

  pressure: `당신은 채용 면접의 압박 면접관입니다.
지원자의 답변에서 논리적 허점이나 근거 부족을 찾아 날카롭게 후속 질문을 던지세요.
답변을 무너뜨리는 게 목적이 아니라 압박 상황에서의 대응력을 평가하는 것임을 유지하세요.
너무 공격적이지 않게, 그러나 쉽게 넘어가지 않도록 질문하세요.`,
};
