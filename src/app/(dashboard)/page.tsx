import { InterviewChat, type ResumeData } from "@/components/InterviewChat";
import { createClient } from "@/lib/supabase/server";
import { groupMessagesByRole } from "@/lib/interview/transcript";
import { INTERVIEWER_ORDER } from "@/lib/interview/roles";

// interview_reports는 session_id가 unique라 1:1 관계지만, PostgREST 임베드는
// 상황에 따라 배열 또는 단일 객체로 내려줄 수 있어 둘 다 방어적으로 처리한다.
function firstReport<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export default async function NewInterviewPage(props: PageProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 회원가입 시 입력한 이름(user_metadata.full_name) — 홈 화면 상단 인사말에 쓴다.
  // 로그인 여부는 layout.tsx가 이미 보장하므로 여기서는 이름이 비어있는 경우만 방어한다.
  const userName = (user?.user_metadata?.full_name as string | undefined)?.trim() || null;

  // 사이드바의 "진행 중인 면접"에서 넘어온 경우(/?resume=<세션ID>) — DB에서 세션 정보와
  // 그동안의 대화를 읽어와 InterviewChat이 "이어서 진행하는 상태"로 시작할 수 있게 만든다.
  const searchParams = await props.searchParams;
  const resumeId = typeof searchParams.resume === "string" ? searchParams.resume : null;

  let resumeData: ResumeData | null = null;
  if (resumeId) {
    const { data: session } = await supabase
      .from("interview_sessions")
      .select("id, job_role, resume_content, portfolio_content, interview_reports(id)")
      .eq("id", resumeId)
      .is("deleted_at", null)
      .single();

    // 이미 완료돼서 리포트가 있는 세션은 이어서 진행할 대상이 아니다(그건 /history/[id]에서 본다).
    // RLS로 막혀서 못 읽어오거나 삭제된 세션이면 session 자체가 null이라 자연히 걸러진다.
    if (session && !firstReport(session.interview_reports)) {
      const { data: messages } = await supabase
        .from("interview_messages")
        .select("interviewer_role, sender, content")
        .eq("session_id", resumeId)
        .order("created_at", { ascending: true });

      const history = groupMessagesByRole(messages ?? []);
      const hasAnyMessages = INTERVIEWER_ORDER.some((role) => history[role].length > 0);

      if (hasAnyMessages) {
        // 대화가 남아있는 면접관 중 순서상 가장 마지막(=면접이 끊긴 시점)부터 이어서 보여준다.
        let interviewerIndex = 0;
        for (let i = INTERVIEWER_ORDER.length - 1; i >= 0; i--) {
          if (history[INTERVIEWER_ORDER[i]].length > 0) {
            interviewerIndex = i;
            break;
          }
        }
        resumeData = {
          sessionId: session.id as string,
          jobRole: (session.job_role as string | null) ?? "",
          resumeContent: (session.resume_content as string | null) ?? "",
          portfolioContent: (session.portfolio_content as string | null) ?? "",
          history,
          interviewerIndex,
        };
      }
    }
  }

  // resumeData 유무·세션이 바뀔 때마다 InterviewChat을 완전히 새로 마운트해서 내부 상태가
  // 이전 화면(다른 세션이거나 새 면접)의 값으로 남아있지 않게 한다.
  return <InterviewChat key={resumeData?.sessionId ?? "new"} userName={userName} resumeData={resumeData} />;
}
