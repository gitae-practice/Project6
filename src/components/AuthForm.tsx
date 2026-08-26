"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setIsSubmitting(false);
        return;
      }
      router.refresh(); // 서버 컴포넌트가 로그인 상태를 다시 읽도록 새로고침
      return;
    }

    // 회원가입 — 프로젝트 설정에 따라 이메일 인증이 필요할 수 있다.
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }
    if (!data.session) {
      setNotice("가입 확인 메일을 보냈습니다. 메일함을 확인한 뒤 로그인해주세요.");
      setIsSubmitting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-2xl font-bold">오늘의 면접관</h1>
      <p className="-mt-4 text-sm text-muted">
        {mode === "login" ? "로그인하고 면접을 시작하세요" : "계정을 만들고 시작하세요"}
      </p>

      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          required
          className="rounded-xl border border-border bg-surface px-4 py-2 outline-none focus:border-accent"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (6자 이상)"
          minLength={6}
          required
          className="rounded-xl border border-border bg-surface px-4 py-2 outline-none focus:border-accent"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-muted">{notice}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-accent px-6 py-2.5 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isSubmitting ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setError(null);
          setNotice(null);
        }}
        className="text-xs text-muted hover:text-accent hover:underline"
      >
        {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
      </button>
    </div>
  );
}
