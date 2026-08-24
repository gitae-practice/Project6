import { InterviewChat } from "@/components/InterviewChat";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="font-semibold">오늘의 면접관</span>
        <ThemeToggle />
      </header>
      <InterviewChat />
    </div>
  );
}
