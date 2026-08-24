"use client";

import { useEffect, useRef } from "react";

// 라이트/다크 테마 토글 버튼.
//
// React state 대신 ref로 DOM(html 클래스, 버튼 라벨)을 직접 조작한다.
// 이유: 초기 테마 값은 localStorage/matchMedia 같은 브라우저 전용 API로만 알 수 있는데,
// 이걸 state로 관리하면 effect 안에서 setState를 호출하게 되어
// 1) React의 set-state-in-effect 규칙 위반, 2) 서버 렌더링(SSR) 결과와 클라이언트 값이
// 달라 하이드레이션 불일치가 생길 수 있다. DOM을 직접 건드리면 두 문제 모두 피할 수 있다.
export function ThemeToggle() {
  const labelRef = useRef<HTMLSpanElement>(null);

  function applyTheme(dark: boolean) {
    document.documentElement.classList.toggle("dark", dark);
    if (labelRef.current) {
      labelRef.current.textContent = dark ? "🌙 다크" : "☀️ 라이트";
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(stored ? stored === "dark" : prefersDark);
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
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:border-accent hover:text-accent"
    >
      <span ref={labelRef}>☀️ 라이트</span>
    </button>
  );
}
