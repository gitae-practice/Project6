-- Project6: 오늘의 면접관 DB 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에서 이 파일 내용을 실행한다.

-- 면접 세션 하나 = 대화 한 판 (기술/인성/압박 면접관 순회 전체)
create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- 이 세션의 소유자
  job_role text, -- 지원 직무 (필수 입력)
  resume_content text, -- 이력서 내용: 직접 입력 또는 PDF 업로드 시 Claude가 추출한 원문 (필수 - 둘 중 하나)
  portfolio_content text, -- 포트폴리오 PDF 업로드 시 Claude가 추출한 원문 (선택 입력)
  created_at timestamptz not null default now()
);

-- 이미 만들어진 테이블에 새 컬럼을 추가하는 경우를 위한 안전한 재실행용 구문
alter table interview_sessions add column if not exists job_role text;
alter table interview_sessions add column if not exists resume_content text;
alter table interview_sessions add column if not exists portfolio_content text;
alter table interview_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;

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

-- 면접 종료 후 생성되는 종합 평가 리포트. 세션 하나당 리포트 하나(1:1)라 session_id를 unique로 둔다.
create table if not exists interview_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references interview_sessions(id) on delete cascade,
  overall_score numeric not null,
  summary text not null,
  interviewer_feedback jsonb not null, -- { technical, personality, pressure } 각각 문자열
  strengths text[] not null,
  improvements text[] not null,
  created_at timestamptz not null default now()
);

alter table interview_sessions enable row level security;
alter table interview_messages enable row level security;
alter table interview_reports enable row level security;

-- 로그인 붙이기 전 임시로 썼던 전체 허용 정책 — 있으면 지운다 (재실행 안전하게)
drop policy if exists "temp_allow_all_sessions" on interview_sessions;
drop policy if exists "temp_allow_all_messages" on interview_messages;

-- 본인 세션만 조회/생성/수정/삭제 가능
drop policy if exists "select_own_sessions" on interview_sessions;
drop policy if exists "insert_own_sessions" on interview_sessions;
drop policy if exists "update_own_sessions" on interview_sessions;
drop policy if exists "delete_own_sessions" on interview_sessions;

create policy "select_own_sessions" on interview_sessions
  for select using (auth.uid() = user_id);

create policy "insert_own_sessions" on interview_sessions
  for insert with check (auth.uid() = user_id);

create policy "update_own_sessions" on interview_sessions
  for update using (auth.uid() = user_id);

create policy "delete_own_sessions" on interview_sessions
  for delete using (auth.uid() = user_id);

-- 메시지는 자기 소유 세션에 달린 것만 접근 가능 (세션 테이블을 통해 소유권 확인)
drop policy if exists "select_own_messages" on interview_messages;
drop policy if exists "insert_own_messages" on interview_messages;

create policy "select_own_messages" on interview_messages
  for select using (
    exists (
      select 1 from interview_sessions s
      where s.id = interview_messages.session_id and s.user_id = auth.uid()
    )
  );

create policy "insert_own_messages" on interview_messages
  for insert with check (
    exists (
      select 1 from interview_sessions s
      where s.id = interview_messages.session_id and s.user_id = auth.uid()
    )
  );

-- 리포트도 메시지와 같은 방식으로 소유권을 확인한다 (session_id를 통해).
-- update까지 포함해야 재시도(같은 세션에 다시 upsert) 시 막히지 않는다.
drop policy if exists "select_own_reports" on interview_reports;
drop policy if exists "upsert_own_reports" on interview_reports;

create policy "select_own_reports" on interview_reports
  for select using (
    exists (
      select 1 from interview_sessions s
      where s.id = interview_reports.session_id and s.user_id = auth.uid()
    )
  );

create policy "upsert_own_reports" on interview_reports
  for all using (
    exists (
      select 1 from interview_sessions s
      where s.id = interview_reports.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from interview_sessions s
      where s.id = interview_reports.session_id and s.user_id = auth.uid()
    )
  );

-- "Automatically expose new tables"를 꺼둔 상태라 RLS 정책과 별개로
-- 테이블 자체 접근 권한(GRANT)을 직접 줘야 PostgREST가 응답한다.
-- anon(비로그인)은 이제 필요 없지만, 혹시 남겨둔 다른 용도가 있을까봐 authenticated만 명시적으로 부여.
grant usage on schema public to authenticated;
grant select, insert, update, delete on interview_sessions to authenticated;
grant select, insert, update, delete on interview_messages to authenticated;
grant select, insert, update, delete on interview_reports to authenticated;
