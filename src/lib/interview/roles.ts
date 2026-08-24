// 면접관 역할 정의.
// 세 명의 면접관이 정해진 순서(INTERVIEWER_ORDER)대로 등장하며,
// 각자 다른 system prompt로 Claude를 호출해 성격이 다른 질문을 던진다.

export type InterviewerRole = "technical" | "personality" | "pressure";

export interface InterviewerMeta {
  role: InterviewerRole;
  label: string; // 화면에 표시할 이름
  emoji: string; // 구분용 아이콘
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
    emoji: "🛠️",
    description: "프로젝트 경험과 기술 선택의 근거를 파고듭니다",
  },
  personality: {
    role: "personality",
    label: "인성 면접관",
    emoji: "🤝",
    description: "협업 경험과 갈등 상황 대처를 확인합니다",
  },
  pressure: {
    role: "pressure",
    label: "압박 면접관",
    emoji: "🔥",
    description: "답변의 허점을 파고드는 후속 질문을 던집니다",
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
