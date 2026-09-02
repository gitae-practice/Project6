"use client";

import type { ChangeEvent } from "react";

interface PdfUploadStripProps {
  inputId: string; // 한 화면에 여러 개(이력서/포트폴리오) 올라갈 수 있어 각자 다른 id를 받는다
  idleText: string; // 업로드 전 안내 문구
  successText: string; // 업로드 완료 후 안내 문구 (파일명 등은 호출한 쪽에서 만들어 넘긴다)
  isExtracting: boolean;
  hasResult: boolean;
  error: string | null;
  onFileSelected: (file: File) => void;
}

// 이력서/포트폴리오 PDF 업로드 UI — 점선 테두리 박스 + "PDF 선택" 버튼 + 상태 문구.
// 업로드된 내용은 화면에 그대로 노출하지 않고 면접관이 "기억"만 하게 한다.
export function PdfUploadStrip({
  inputId,
  idleText,
  successText,
  isExtracting,
  hasResult,
  error,
  onFileSelected,
}: PdfUploadStripProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일을 다시 선택해도 onChange가 발생하도록 초기화
    if (file) onFileSelected(file);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5">
        <span className="flex-1 truncate text-xs text-muted">
          {isExtracting ? "PDF를 읽고 있습니다..." : hasResult ? successText : idleText}
        </span>
        <label
          htmlFor={inputId}
          className={`shrink-0 cursor-pointer rounded-lg border px-3 py-1 text-xs transition-colors ${
            isExtracting ? "cursor-not-allowed border-border text-muted" : "border-accent/40 text-accent hover:bg-accent/10"
          }`}
        >
          PDF 선택
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/pdf"
          onChange={handleChange}
          disabled={isExtracting}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
