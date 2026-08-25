-- Project6: 모의 면접관 3인방 DB 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에서 이 파일 내용을 실행한다.

-- 면접 세션 하나 = 대화 한 판 (기술/인성/압박 면접관 순회 전체)
create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  job_role text, -- 지원 직무 (선택 입력)
  resume_content text, -- 이력서 내용: 직접 입력 또는 PDF 업로드 시 Claude가 추출한 원문 (선택 입력)
  created_at timestamptz not null default now()
);

-- 이미 만들어진 테이블에 새 컬럼을 추가하는 경우를 위한 안전한 재실행용 구문
alter table interview_sessions add column if not exists job_role text;
alter table interview_sessions add column if not exists resume_content text;

-- 세션 안의 개별 메시지 (사용자 답변 / 면접관 질문·피드백)
create table if not exists interview_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  interviewer_role text not null check (interviewer_role in ('technical', 'personality', 'pressure')),
  sender text not null check (sender in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists interview_messages_session_id_idx
  on interview_messages (session_id);

-- 로그인 기능 도입 전까지는 임시로 전체 허용 정책을 둔다.
-- Auth 붙이는 다음 단계에서 반드시 "본인 세션만 접근 가능"으로 좁혀야 함 (NOTES.md 참고).
alter table interview_sessions enable row level security;
alter table interview_messages enable row level security;

create policy "temp_allow_all_sessions" on interview_sessions
  for all using (true) with check (true);

create policy "temp_allow_all_messages" on interview_messages
  for all using (true) with check (true);

-- "Automatically expose new tables"를 꺼둔 상태라 RLS 정책과 별개로
-- anon 역할에 테이블 자체 접근 권한(GRANT)을 직접 줘야 PostgREST가 응답한다.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on interview_sessions to anon, authenticated;
grant select, insert, update, delete on interview_messages to anon, authenticated;
