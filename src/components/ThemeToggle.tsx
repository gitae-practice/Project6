"use client";

import { useEffect, useRef } from "react";
import { Moon, Sun } from "lucide-react";

// 라이트/다크 테마 토글 버튼.
//
// React state 대신 ref로 DOM(html 클래스, 아이콘 표시 여부)을 직접 조작한다.
// 이유: 초기 테마 값은 localStorage/matchMedia 같은 브라우저 전용 API로만 알 수 있는데,
// 이걸 state로 관리하면 effect 안에서 setState를 호출하게 되어
// 1) React의 set-state-in-effect 규칙 위반, 2) 서버 렌더링(SSR) 결과와 클라이언트 값이
// 달라 하이드레이션 불일치가 생길 수 있다. DOM을 직접 건드리면 두 문제 모두 피할 수 있다.
export function ThemeToggle() {
  const sunRef = useRef<HTMLSpanElement>(null);
  const moonRef = useRef<HTMLSpanElement>(null);

  function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle("dark", dark);
    // 다크 모드면 "지금 라이트로 바꿀 수 있다"는 의미의 해 아이콘을,
    // 라이트 모드면 달 아이콘을 보여준다 (다음에 누르면 될 상태를 표시).
    sunRef.current?.classList.toggle("hidden", !dark);
    moonRef.current?.classList.toggle("hidden", dark);
  }

  // 기본 테마는 다크모드 — localStorage에 저장된 값이 있으면 그 값을 우선한다.
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    applyTheme(stored ? stored === "dark" : true);
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    applyTheme(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="테마 전환"
      title="테마 전환"
      className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-border hover:text-accent"
    >
      <span ref={sunRef} className="hidden">
        <Sun className="h-5 w-5" />
      </span>
      <span ref={moonRef}>
        <Moon className="h-5 w-5" />
      </span>
    </button>
  );
}
