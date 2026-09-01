"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { ReportCard } from "@/components/ReportCard";
import type { InterviewReport } from "@/lib/interview/report";

interface ReportWithDownloadProps {
  report: InterviewReport;
  fileName: string; // 예: "오늘의면접관_프론트엔드개발자.pdf"
}

// ReportCard를 그대로 캡처해 PDF로 저장하는 다운로드 버튼을 붙인 래퍼.
// 방금 끝난 면접 화면(InterviewChat)과 지난 기록 상세 화면(history/[id]) 둘 다에서 재사용한다.
//
// 텍스트 기반 PDF(예: @react-pdf/renderer) 대신 화면 스크린샷 방식(html2canvas-pro + jsPDF)을 쓴 이유:
// 리포트 카드가 한글이라 PDF 라이브러리에 한글 폰트를 별도로 임베드해야 하는데, 이러면 폰트 파일을
// 따로 번들에 넣어야 하고 라이트/다크 테마·아이콘·컬러 같은 실제 디자인을 그대로 옮기려면 카드 레이아웃을
// PDF 전용 컴포넌트로 통째로 다시 만들어야 한다. 화면을 그대로 캡처하면 이미 그려진 디자인을 그대로
// 재사용할 수 있고 폰트 문제도 없다.
//
// html2canvas가 아니라 html2canvas-pro를 쓰는 이유: Tailwind v4 기본 팔레트(blue-400 등)가
// oklch() 색상 함수를 쓰는데, 원조 html2canvas는 oklch를 못 읽어서 캡처 도중 에러가 난다.
// html2canvas-pro는 oklch/oklab/lab/lch까지 지원하는 유지보수 포크라 그대로 대체해서 쓴다.
export function ReportWithDownload({ report, fileName }: ReportWithDownloadProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleDownload() {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportError(null);
    try {
      // html2canvas-pro/jsPDF는 이 버튼을 누를 때만 필요하므로 동적 import로 초기 번들에서 제외한다.
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2, // 레티나 화질
        useCORS: true,
      });

      // 카드를 A4 등 정해진 규격에 억지로 맞추지 않고, 캡처한 크기 그대로 한 페이지짜리 PDF로 만든다
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
      setIsExporting(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* 캡처 대상 — 배경을 명시적으로 깔아줘야 글래스 카드 바깥이 투명하게 찍히지 않는다 */}
      <div ref={cardRef} className="w-full bg-background p-1">
        <ReportCard report={report} />
      </div>

      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={isExporting}
        className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 px-5 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        {isExporting ? "PDF 생성 중..." : "PDF로 다운로드"}
      </button>
      {exportError && <p className="text-xs text-red-500">{exportError}</p>}
    </div>
  );
}
