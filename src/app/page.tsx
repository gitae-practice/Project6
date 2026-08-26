import { InterviewChat } from "@/components/InterviewChat";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthForm } from "@/components/AuthForm";
import { LogoutButton } from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <span className="font-semibold">오늘의 면접관</span>
        <div className="flex items-center gap-2">
          {user && <LogoutButton />}
          <ThemeToggle />
        </div>
      </header>
      {user ? <InterviewChat /> : <AuthForm />}
    </div>
  );
}
