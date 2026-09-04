import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportCard } from "@/components/ReportCard";
import { PdfExportSection } from "@/components/PdfExportSection";
import { InterviewTranscript } from "@/components/InterviewTranscript";
import type { InterviewReport } from "@/lib/interview/report";
import { groupMessagesByRole } from "@/lib/interview/transcript";

export default async function HistoryDetailPage(props: PageProps<"/history/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("id, job_role, created_at, interview_reports(*)")
    .eq("id", id)
    .single();

  const reportRow = Array.isArray(session?.interview_reports)
    ? session.interview_reports[0]
    : session?.interview_reports;

  if (!session || !reportRow) {
    notFound(); // 본인 세션이 아니거나(RLS로 아예 안 보임) 아직 리포트가 없는 경우
  }

  const report: InterviewReport = {
    overall_score: reportRow.overall_score,
    summary: reportRow.summary,
    interviewer_feedback: reportRow.interviewer_feedback,
    strengths: reportRow.strengths,
    improvements: reportRow.improvements,
  };

  const { data: messages } = await supabase
    .from("interview_messages")
    .select("interviewer_role, sender, content")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const history = groupMessagesByRole(messages ?? []);

  const date = new Date(session.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const jobRole = session.job_role || "직무 미입력";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {/* 날짜/직무 헤더 + 다운로드 버튼(우측 상단 고정) + 리포트 + 대화 전문을
            PdfExportSection이 하나의 캡처 영역으로 묶는다. */}
        <PdfExportSection
          fileName={`오늘의면접관_${jobRole.replace(/[\\/:*?"<>|]/g, "_")}_리포트.pdf`}
          header={
            <div>
              <p className="text-xs text-muted">{date}</p>
              <h1 className="text-xl font-bold">{jobRole}</h1>
            </div>
          }
          report={<ReportCard report={report} />}
          transcript={<InterviewTranscript history={history} />}
        />
      </div>
    </div>
  );
}
