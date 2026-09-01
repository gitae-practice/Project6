"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";

interface PdfExportSectionProps {
  fileName: string; // 예: "오늘의면접관_프론트엔드개발자_리포트.pdf"
  header: ReactNode; // 날짜/직무 등 상단 정보 — 체크박스와 무관하게 항상 포함됨
  report: ReactNode; // 리포트 카드 — "리포트" 체크박스로 포함 여부 선택
  transcript: ReactNode; // 대화 전문 — "대화 내역" 체크박스로 포함 여부 선택
}

// 리포트/대화 내역을 PDF로 내보내는 다운로드 버튼. 우측 상단에 고정 배치되고,
// 클릭하면 바로 다운로드하지 않고 "어떤 내용을 포함할지" 체크박스로 먼저 고른 뒤 다운로드한다.
// 방금 끝난 면접 화면(InterviewChat)과 지난 기록 상세 화면(history/[id]) 둘 다에서 재사용한다.
//
// 텍스트 기반 PDF(예: @react-pdf/renderer) 대신 화면 스크린샷 방식(html2canvas-pro + jsPDF)을 쓴 이유:
// 리포트가 한글이라 PDF 라이브러리에 한글 폰트를 별도로 임베드해야 하는데, 이러면 폰트 파일을
// 따로 번들에 넣어야 하고 라이트/다크 테마·아이콘·컬러 같은 실제 디자인을 그대로 옮기려면 레이아웃을
// PDF 전용 컴포넌트로 통째로 다시 만들어야 한다. 화면을 그대로 캡처하면 이미 그려진 디자인을 그대로
// 재사용할 수 있고 폰트 문제도 없다.
//
// html2canvas가 아니라 html2canvas-pro를 쓰는 이유: Tailwind v4 기본 팔레트(blue-400 등)가
// oklch() 색상 함수를 쓰는데, 원조 html2canvas는 oklch를 못 읽어서 캡처 도중 에러가 난다.
// html2canvas-pro는 oklch/oklab/lab/lch까지 지원하는 유지보수 포크라 그대로 대체해서 쓴다.
export function PdfExportSection({ fileName, header, report, transcript }: PdfExportSectionProps) {
  const captureRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null); // 버튼+체크박스 팝오버 — 캡처 시 잠깐 숨김
  const reportRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [includeReport, setIncludeReport] = useState(true);
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // 팝오버 바깥을 클릭하면 닫히게 한다.
  useEffect(() => {
    if (!isMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  async function handleConfirmDownload() {
    if (!captureRef.current) return;
    setIsMenuOpen(false);
    setIsExporting(true);
    setExportError(null);

    // 체크 해제한 영역은 캡처 직전에만 잠깐 화면에서 숨겼다가 캡처 후 원래대로 되돌린다.
    // React state로 리렌더를 기다리지 않고 DOM을 직접 건드려서, html2canvas 호출 시점과
    // 정확히 동기적으로 맞출 수 있게 했다 (버튼 팝오버 자체도 캡처에 안 담기게 여기서 같이 숨김).
    if (controlsRef.current) controlsRef.current.style.visibility = "hidden";
    if (reportRef.current) reportRef.current.style.display = includeReport ? "" : "none";
    if (transcriptRef.current) transcriptRef.current.style.display = includeTranscript ? "" : "none";

    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2, // 레티나 화질
        useCORS: true,
      });

      // 정해진 규격(A4 등)에 억지로 맞추지 않고, 캡처한 크기 그대로 한 페이지짜리 PDF로 만든다
      // (내용이 잘리거나 여러 페이지로 나뉘는 것을 방지).
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        compress: true,
      });
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, canvas.width, canvas.height);
      pdf.save(fileName);
    } catch (error) {
      // 사용자에게는 간단한 메시지만 보여주고, 원인은 콘솔에 남겨서 다음에 디버깅하기 쉽게 한다.
      console.error("PDF 생성 실패:", error);
      setExportError("PDF 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      if (controlsRef.current) controlsRef.current.style.visibility = "";
      if (reportRef.current) reportRef.current.style.display = "";
      if (transcriptRef.current) transcriptRef.current.style.display = "";
      setIsExporting(false);
    }
  }

  const nothingSelected = !includeReport && !includeTranscript;

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      {/* 캡처 대상 — 헤더/버튼 행 + 리포트 + 대화 전문. 배경을 명시적으로 깔아둬야
          글래스 카드 바깥이 투명하게 찍히지 않는다. */}
      <div ref={captureRef} className="flex w-full flex-col gap-6 bg-background">
        <div className="flex items-start justify-between gap-4">
          {header}

          {/* 버튼 + 체크박스 팝오버 — 우측 상단 고정, 캡처에는 포함되지 않음 */}
          <div ref={controlsRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-xl border border-accent/40 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "PDF 생성 중..." : "PDF로 다운로드"}
            </button>

            {isMenuOpen && (
              <div
                ref={menuRef}
                className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-border bg-surface p-4 shadow-lg"
              >
                <p className="mb-3 text-xs font-medium text-muted">포함할 내용</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeReport}
                      onChange={(e) => setIncludeReport(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    리포트
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={includeTranscript}
                      onChange={(e) => setIncludeTranscript(e.target.checked)}
                      className="h-4 w-4 accent-accent"
                    />
                    대화 내역
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void handleConfirmDownload()}
                  disabled={nothingSelected}
                  className="mt-3 w-full rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다운로드
                </button>
              </div>
            )}
          </div>
        </div>

        <div ref={reportRef}>{report}</div>
        <div ref={transcriptRef}>{transcript}</div>
      </div>

      {exportError && <p className="text-xs text-red-500">{exportError}</p>}
    </div>
  );
}
