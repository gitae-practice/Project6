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

-- ────────────────────────────────────────────────────────────────────────
-- 관리자 대시보드용 집계 함수
-- ────────────────────────────────────────────────────────────────────────
-- security definer로 만들어서 RLS를 우회해 전체 유저/세션을 집계할 수 있게 하되,
-- 개별 유저의 이메일·이름 같은 개인정보는 절대 반환하지 않고 숫자로 집계된 결과만 돌려준다.
-- 관리자 계정 여부는 함수 안에서 직접 확인한다 — 이 방식이면 앱 코드(Next.js)에
-- Supabase service_role 키를 전혀 두지 않아도 되고, 관리자 판별 로직도 DB 한 곳에만 존재한다.
create or replace function admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if (auth.jwt() ->> 'email') is distinct from 'admin@admin.com' then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'total_sessions', (select count(*) from interview_sessions),
    'completed_interviews', (select count(*) from interview_reports),
    'average_score', (select round(avg(overall_score)::numeric, 1) from interview_reports),
    -- 진행 중 = 세션은 만들어졌지만 아직 리포트가 없는 경우. 별도 status 컬럼 없이 판단한다.
    'in_progress_sessions', (
      select count(*) from interview_sessions s
      where not exists (select 1 from interview_reports r where r.session_id = s.id)
    ),
    'new_users_today', (select count(*) from auth.users where created_at::date = current_date),
    'top_job_roles', (
      select coalesce(jsonb_agg(jsonb_build_object('job_role', job_role, 'count', cnt)), '[]'::jsonb)
      from (
        select job_role, count(*) as cnt
        from interview_sessions
        where job_role is not null and job_role <> ''
        group by job_role
        order by cnt desc, job_role
        limit 5
      ) t
    ),
    'sessions_last_7_days', (
      select coalesce(jsonb_agg(jsonb_build_object('date', to_char(d, 'MM/DD'), 'count', cnt) order by d), '[]'::jsonb)
      from (
        select gs::date as d, count(s.id) as cnt
        from generate_series(current_date - interval '6 days', current_date, interval '1 day') as gs
        left join interview_sessions s on date_trunc('day', s.created_at)::date = gs::date
        group by gs
        order by gs
      ) t
    ),
    -- 점수 구간은 데이터가 없는 구간도 0건으로 항상 5개 다 나오게 고정 목록에 왼쪽 조인한다.
    'score_distribution', (
      select jsonb_agg(jsonb_build_object('range', b.range, 'count', coalesce(c.cnt, 0)) order by b.ord)
      from (
        select * from (values ('0-2', 1), ('3-4', 2), ('5-6', 3), ('7-8', 4), ('9-10', 5)) as v(range, ord)
      ) b
      left join (
        select
          case
            when overall_score <= 2 then '0-2'
            when overall_score <= 4 then '3-4'
            when overall_score <= 6 then '5-6'
            when overall_score <= 8 then '7-8'
            else '9-10'
          end as range,
          count(*) as cnt
        from interview_reports
        group by 1
      ) c on c.range = b.range
    )
  ) into result;

  return result;
end;
$$;

-- 로그인한 사용자면 누구나 호출은 가능하지만, 함수 안에서 admin 이메일이 아니면 예외를 던진다.
grant execute on function admin_dashboard_stats() to authenticated;

-- 이메일을 앞 3글자 + *** + 도메인만 남기고 마스킹한다 (예: abc***@gmail.com).
-- 관리자 화면이라도 개별 유저 이메일 전체를 그대로 노출하지 않기 위해 DB 함수 안에서부터 가공한다.
create or replace function admin_mask_email(raw_email text)
returns text
language sql
immutable
as $$
  select left(split_part(raw_email, '@', 1), 3) || '***@' || split_part(raw_email, '@', 2);
$$;

-- 유저별 요약 목록 — 이메일은 마스킹, 세션 통계만 집계해서 준다.
create or replace function admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if (auth.jwt() ->> 'email') is distinct from 'admin@admin.com' then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  select coalesce(jsonb_agg(row_data order by last_session_at desc nulls last), '[]'::jsonb)
  into result
  from (
    select
      u.id as user_id,
      admin_mask_email(u.email) as masked_email,
      u.created_at as joined_at,
      count(s.id) as total_sessions,
      max(s.created_at) as last_session_at,
      round(avg(r.overall_score)::numeric, 1) as average_score
    from auth.users u
    left join interview_sessions s on s.user_id = u.id
    left join interview_reports r on r.session_id = s.id
    where u.email is distinct from 'admin@admin.com' -- 관리자 본인은 목록에서 제외
    group by u.id, u.email, u.created_at
  ) row_data;

  return result;
end;
$$;

grant execute on function admin_list_users() to authenticated;

-- 전체 세션 목록 — 이메일은 마스킹, user_id는 화면에는 안 보이지만 유저별 필터링용으로 같이 내려준다.
create or replace function admin_list_sessions()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if (auth.jwt() ->> 'email') is distinct from 'admin@admin.com' then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into result
  from (
    select
      s.id as session_id,
      s.user_id,
      admin_mask_email(u.email) as masked_email,
      s.job_role,
      s.created_at,
      r.overall_score,
      (r.id is not null) as is_completed
    from interview_sessions s
    join auth.users u on u.id = s.user_id
    left join interview_reports r on r.session_id = s.id
    order by s.created_at desc
    limit 500
  ) row_data;

  return result;
end;
$$;

grant execute on function admin_list_sessions() to authenticated;

-- 세션 하나의 전체 상세(리포트 + 대화 전문) — 유저 모달/세션 모달 둘 다 이 함수 하나로 처리한다.
create or replace function admin_get_session_detail(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result jsonb;
begin
  if (auth.jwt() ->> 'email') is distinct from 'admin@admin.com' then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  select jsonb_build_object(
    'session_id', s.id,
    'masked_email', admin_mask_email(u.email),
    'job_role', s.job_role,
    'created_at', s.created_at,
    'report', (
      select jsonb_build_object(
        'overall_score', r.overall_score,
        'summary', r.summary,
        'interviewer_feedback', r.interviewer_feedback,
        'strengths', r.strengths,
        'improvements', r.improvements
      )
      from interview_reports r
      where r.session_id = s.id
    ),
    'messages', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('interviewer_role', m.interviewer_role, 'sender', m.sender, 'content', m.content)
          order by m.created_at
        ),
        '[]'::jsonb
      )
      from interview_messages m
      where m.session_id = s.id
    )
  )
  into result
  from interview_sessions s
  join auth.users u on u.id = s.user_id
  where s.id = target_session_id;

  if result is null then
    raise exception '세션을 찾을 수 없습니다.';
  end if;

  return result;
end;
$$;

grant execute on function admin_get_session_detail(uuid) to authenticated;
