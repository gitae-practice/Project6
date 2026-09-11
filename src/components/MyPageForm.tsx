"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/supabase/authErrors";

// 인풋 하나의 스타일 — 로그인/회원가입 화면(AuthForm)과 동일한 디자인 시스템을 그대로 따른다.
const INPUT_CLASS =
  "w-full rounded-xl border border-border bg-white/6 py-2.5 pl-10 pr-4 outline-none transition-colors placeholder:text-neutral-500 focus:border-accent focus:ring-2 focus:ring-accent/20";
const SUBMIT_BUTTON_CLASS =
  "mt-1 w-full rounded-xl bg-linear-to-r from-orange-500 to-amber-500 px-6 py-2.5 font-medium text-white shadow-lg shadow-orange-500/20 transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100";

// 마이페이지는 이름/비밀번호를 바꿀 수 있는 민감한 화면이라, 들어가자마자 바로 폼을 보여주지 않고
// 비밀번호를 한 번 더 입력해서 본인 확인(재인증)을 통과해야 상세 화면으로 넘어가게 한다.
// (나중에 회원탈퇴 기능을 추가할 때도 이 재인증 단계를 그대로 재사용할 수 있게 구조를 남겨둔다)
export function MyPageForm({ email, initialName }: { email: string; initialName: string }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">마이페이지</h1>
        <p className="mt-1 text-sm text-muted">
          {isUnlocked ? "이름과 비밀번호를 변경할 수 있어요" : "본인 확인을 위해 비밀번호를 입력해주세요"}
        </p>
      </div>
      {isUnlocked ? (
        <ProfileEditForm email={email} initialName={initialName} />
      ) : (
        <ReauthGate email={email} onVerified={() => setIsUnlocked(true)} />
      )}
    </div>
  );
}

// 1단계 — 비밀번호 재확인. signInWithPassword를 다시 호출해서 맞는 비밀번호인지만 검증한다
// (이미 로그인된 세션이라 로그인 자체가 목적은 아니고, 재검증에 성공하면 세션도 자연히 갱신된다).
function ReauthGate({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsSubmitting(false);

    if (error) {
      setError(translateAuthError(error));
      return;
    }
    onVerified();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input type="email" value={email} disabled className={`${INPUT_CLASS} cursor-not-allowed opacity-60`} />
      </div>
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          required
          autoFocus
          className={INPUT_CLASS}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button type="submit" disabled={isSubmitting} className={SUBMIT_BUTTON_CLASS}>
        {isSubmitting ? "확인 중..." : "확인"}
      </button>
    </form>
  );
}

// 2단계 — 실제 이름/비밀번호 변경 폼. 이메일은 계정 식별자라 여기서 바꿀 수 없게 막아둔다.
function ProfileEditForm({ email, initialName }: { email: string; initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    // 비밀번호 입력칸은 "변경하지 않으려면 비워두세요" 방식이라, 채운 경우에만 검증한다.
    if (newPassword && newPassword.length < 6) {
      setError("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword && newPassword !== newPasswordConfirm) {
      setError("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: name.trim() },
      ...(newPassword ? { password: newPassword } : {}),
    });
    setIsSubmitting(false);

    if (error) {
      setError(translateAuthError(error));
      return;
    }
    setNewPassword("");
    setNewPasswordConfirm("");
    setNotice("저장했습니다.");
    router.refresh(); // 홈 화면 인사말 등 다른 곳에서도 바뀐 이름을 바로 반영하도록
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input type="email" value={email} disabled className={`${INPUT_CLASS} cursor-not-allowed opacity-60`} />
      </div>
      <p className="-mt-2 text-xs text-muted">이메일은 변경할 수 없어요</p>

      <div className="relative">
        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          required
          className={INPUT_CLASS}
        />
      </div>

      <div className="relative">
        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="새 비밀번호 (변경하지 않으려면 비워두세요)"
          minLength={6}
          className={INPUT_CLASS}
        />
      </div>
      {newPassword && (
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            placeholder="새 비밀번호 확인"
            minLength={6}
            className={INPUT_CLASS}
          />
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}

      <button type="submit" disabled={isSubmitting} className={SUBMIT_BUTTON_CLASS}>
        {isSubmitting ? "저장 중..." : "저장"}
      </button>
    </form>
  );
}
