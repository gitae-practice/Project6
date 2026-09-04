"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { Mail, Lock, User, Code2, Heart, Zap, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppLogoIcon } from "@/components/AppLogoIcon";
import { ADMIN_EMAIL } from "@/lib/admin";

type Mode = "login" | "signup";

// Supabase Auth가 영어로 내려주는 에러 메시지를 한글로 바꿔서 보여준다.
// 주의: 로그인 실패("Invalid login credentials")는 이메일이 존재하지 않는 경우와
// 비밀번호가 틀린 경우를 구분해서 알려주지 않는다 — 구분해서 알려주면 "이 이메일로
// 가입된 계정이 있는지"를 외부에서 시도해볼 수 있게 되는 계정 유출(user enumeration)
// 취약점이 생기기 때문에 Supabase가 의도적으로 동일한 메시지를 준다. 그래서 여기서도
// "이메일 또는 비밀번호가 올바르지 않습니다"처럼 어느 쪽이 틀렸는지 밝히지 않는다.
function translateAuthError(error: AuthError): string {
  const message = error.message;
  if (message.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("User already registered")) {
    return "이미 가입된 이메일입니다.";
  }
  if (message.includes("Password should be at least")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (message.includes("Unable to validate email address")) {
    return "올바른 이메일 형식이 아닙니다.";
  }
  if (message.includes("rate limit")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}

// 면접관 3인 뱃지 — 브랜딩 패널 하단에 미리보기로 보여준다. (roles.ts와 동일한 컬러 규칙: 기술=blue, 인성=green, 압박=red)
const PREVIEW_INTERVIEWERS = [
  { label: "기술 면접관", icon: Code2, className: "border-blue-400/30 text-blue-400" },
  { label: "인성 면접관", icon: Heart, className: "border-green-400/30 text-green-400" },
  { label: "압박 면접관", icon: Zap, className: "border-red-400/30 text-red-400" },
];

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
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
        setError(translateAuthError(error));
        setIsSubmitting(false);
        return;
      }
      // 관리자 계정은 로그인 직후 한 번만 대시보드로 보낸다. 레이아웃 쪽에서 매번 강제로
      // 리다이렉트시키면 이후 admin 계정이 다른 화면으로 이동할 방법이 아예 없어지므로
      // (버튼을 눌러도 도로 튕겨나옴) 여기 "로그인 성공 시점"에서만 한 번 처리한다.
      if (email.trim().toLowerCase() === ADMIN_EMAIL) {
        router.push("/admin");
        return;
      }
      router.refresh(); // 서버 컴포넌트가 로그인 상태를 다시 읽도록 새로고침
      return;
    }

    // 회원가입 — 이름은 user_metadata(full_name)에 저장해서, 면접 중 면접관이 이름을 불러줄 때 사용한다.
    // 프로젝트 설정에 따라 이메일 인증이 필요할 수 있다.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) {
      setError(translateAuthError(error));
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
    <div className="relative flex min-h-dvh flex-col bg-background">
      {/* 로그인 화면은 별도 헤더가 없으므로 라이트/다크 토글을 우측 상단에 고정 배치한다 */}
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* 모바일에서는 브랜딩 화면을 먼저 보여주고 옆으로 스와이프하면 폼으로 넘어가는 2패널 슬라이드,
          md 이상에서는 스크롤 없이 좌우 2열로 항상 둘 다 보이는 기존 레이아웃 — CSS scroll-snap만으로
          구현해서 별도 제스처 라이브러리 없이 네이티브 터치 스와이프가 그대로 동작한다. */}
      <div className="flex flex-1 snap-x snap-mandatory overflow-x-auto scrollbar-none md:snap-none md:overflow-visible">
        {/* 슬라이드 1 / 좌측: 브랜딩 패널 */}
        <div className="dot-grid relative flex w-full shrink-0 snap-center flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.15),transparent_55%)] p-10 md:w-auto md:flex-1 md:shrink">
          <div className="flex items-center gap-2">
            <AppLogoIcon />
            <span className="text-lg font-semibold">오늘의 면접관</span>
          </div>

          <h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            <span className="block text-foreground">기술을 묻고,</span>
            <span className="block text-muted">사람을 보고,</span>
            <span className="block text-accent">압박을 견딘다.</span>
          </h1>

          <div className="flex flex-col gap-6">
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

            {/* 스와이프 유도 힌트 — 모바일에서만 보임 */}
            <p className="flex items-center gap-1 text-xs text-muted md:hidden">
              옆으로 밀어 로그인하기 <ChevronRight className="h-3.5 w-3.5" />
            </p>
          </div>
        </div>

        {/* 슬라이드 2 / 우측: 로그인·회원가입 폼 */}
        <div className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-6 bg-surface px-6 py-12 md:w-auto md:flex-1 md:shrink">
          <div className="w-full max-w-sm">
            <h2 className="text-2xl font-bold">{mode === "login" ? "로그인" : "회원가입"}</h2>
            <p className="mt-1 text-sm text-muted">면접을 시작하려면 로그인하세요</p>
          </div>

          <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-3">
            {mode === "signup" && (
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="이름 (면접관이 불러드릴 이름이에요)"
                  required
                  className="w-full rounded-xl border border-border bg-white/6 py-2.5 pl-10 pr-4 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </div>
            )}
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
    </div>
  );
}
