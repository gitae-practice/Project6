import { InterviewChat } from "@/components/InterviewChat";
import { createClient } from "@/lib/supabase/server";

export default async function NewInterviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 회원가입 시 입력한 이름(user_metadata.full_name) — 홈 화면 상단 인사말에 쓴다.
  // 로그인 여부는 layout.tsx가 이미 보장하므로 여기서는 이름이 비어있는 경우만 방어한다.
  const userName = (user?.user_metadata?.full_name as string | undefined)?.trim() || null;

  return <InterviewChat userName={userName} />;
}
