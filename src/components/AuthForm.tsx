"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Code2, Heart, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppLogoIcon } from "@/components/AppLogoIcon";

type Mode = "login" | "signup";

// 면접관 3인 뱃지 — 브랜딩 패널 하단에 미리보기로 보여준다. (roles.ts와 동일한 컬러 규칙: 기술=blue, 인성=green, 압박=red)
const PREVIEW_INTERVIEWERS = [
  { label: "기술 면접관", icon: Code2, className: "border-blue-400/30 text-blue-400" },
  { label: "인성 면접관", icon: Heart, className: "border-green-400/30 text-green-400" },
  { label: "압박 면접관", icon: Zap, className: "border-red-400/30 text-red-400" },
];

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
    <div className="relative flex min-h-dvh flex-col bg-background md:flex-row">
      {/* 로그인 화면은 별도 헤더가 없으므로 라이트/다크 토글을 우측 상단에 고정 배치한다 */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* 좌측: 브랜딩 패널 — 작은 화면에서는 숨기고 폼만 보여준다 */}
      <div className="dot-grid relative hidden flex-1 flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.15),transparent_55%)] p-10 md:flex">
        <div className="flex items-center gap-2">
          <AppLogoIcon />
          <span className="text-lg font-semibold">오늘의 면접관</span>
        </div>

        <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
          <span className="block text-foreground">기술을 묻고,</span>
          <span className="block text-muted">사람을 보고,</span>
          <span className="block text-accent">압박을 견딘다.</span>
        </h1>

        <div className="flex flex-wrap gap-2">
          {PREVIEW_INTERVIEWERS.map(({ label, icon: Icon, className }) => (
            <span
              key={label}
              className={`flex items-center gap-1.5 rounded-xl border bg-background/60 px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${className}`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </span>
          ))}
        </div>
      </div>

      {/* 우측: 로그인/회원가입 폼 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-surface px-6 py-12">
        <div className="flex w-full max-w-sm flex-col gap-1 md:hidden">
          <div className="mb-4 flex items-center justify-center gap-2">
            <AppLogoIcon />
            <span className="font-semibold">오늘의 면접관</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">{mode === "login" ? "로그인" : "회원가입"}</h2>
          <p className="mt-1 text-sm text-muted">면접을 시작하려면 로그인하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일"
              required
              className="w-full rounded-xl border border-border bg-white/6 py-2.5 pl-10 pr-4 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 (6자 이상)"
              minLength={6}
              required
              className="w-full rounded-xl border border-border bg-white/6 py-2.5 pl-10 pr-4 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {notice && <p className="text-sm text-muted">{notice}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 w-full rounded-xl bg-linear-to-r from-orange-500 to-amber-500 px-6 py-2.5 font-medium text-white shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
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
          className="text-xs text-neutral-500 transition-colors hover:text-orange-400"
        >
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </div>
    </div>
  );
}
