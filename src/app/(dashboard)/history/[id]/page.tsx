import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReportWithDownload } from "@/components/ReportWithDownload";
import { INTERVIEWER_META, INTERVIEWER_ICON, INTERVIEWER_ACCENT, type InterviewerRole } from "@/lib/interview/roles";
import type { InterviewReport } from "@/lib/interview/report";

interface MessageRow {
  interviewer_role: InterviewerRole;
  sender: "user" | "assistant";
  content: string;
}

// 면접 시작 트리거 메시지는 실제 대화가 아니므로 화면에서 숨긴다 (report route와 동일 기준).
function isKickoffMessage(row: MessageRow) {
  return row.sender === "user" && row.content.startsWith("면접을 시작해주세요");
}

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

  const date = new Date(session.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-xs text-muted">{date}</p>
          <h1 className="text-xl font-bold">{session.job_role || "직무 미입력"}</h1>
        </div>

        <ReportWithDownload
          report={report}
          fileName={`오늘의면접관_${(session.job_role || "면접").replace(/[\\/:*?"<>|]/g, "_")}_리포트.pdf`}
        />

        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium text-muted">전체 대화</p>
          {(["technical", "personality", "pressure"] as const).map((role) => {
            const Icon = INTERVIEWER_ICON[role];
            const accent = INTERVIEWER_ACCENT[role];
            const turns = (messages as MessageRow[] | null)?.filter(
              (m) => m.interviewer_role === role && !isKickoffMessage(m)
            );
            if (!turns || turns.length === 0) return null;

            return (
              <div key={role} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${accent.softBg}`}>
                    <Icon className={`h-3.5 w-3.5 ${accent.text}`} />
                  </span>
                  <p className="font-medium">{INTERVIEWER_META[role].label}</p>
                </div>
                {/* 위 리포트 카드(Bento grid)와 가로 폭을 맞추기 위해 말풍선을 좌우로 좁히지 않고 컨테이너 전체 너비로 채운다 */}
                <div className="flex flex-col gap-3">
                  {turns.map((turn, i) => (
                    <div
                      key={i}
                      className={`w-full rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        turn.sender === "user" ? "border border-accent/20 bg-accent/10" : "glass-card"
                      }`}
                    >
                      {turn.content}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
