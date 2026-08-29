import { Bot, MessagesSquare, User } from "lucide-react";

// 네브바 로고 마크 — Bot(AI 면접관) · MessagesSquare(대화) · User(지원자) 세 아이콘을
// 가로로 조합해 "AI 면접관과 지원자가 대화한다"는 서비스 컨셉을 표현한다.
// 가운데 대화 아이콘만 살짝 위로 띄워 셋이 리듬감 있게 배치되도록 했다.
export function AppLogoIcon() {
  return (
    <span className="flex items-center gap-1 text-orange-400">
      <Bot className="h-[18px] w-[18px]" strokeWidth={1.75} />
      <MessagesSquare className="h-[18px] w-[18px] -translate-y-[3px]" strokeWidth={1.75} />
      <User className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}
