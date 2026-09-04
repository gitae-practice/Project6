-- Project6: 오늘의 면접관 DB 스키마
-- Supabase 프로젝트 생성 후 SQL Editor에서 이 파일 내용을 실행한다.

-- 면접 세션 하나 = 대화 한 판 (기술/인성/압박 면접관 순회 전체)
create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- 이 세션의 소유자
  job_role text, -- 지원 직무 (필수 입력)
  resume_content text, -- 이력서 내용: 직접 입력 또는 PDF 업로드 시 Claude가 추출한 원문 (필수 - 둘 중 하나)
  portfolio_content text, -- 포트폴리오 PDF 업로드 시 Claude가 추출한 원문 (선택 입력)
  created_at timestamptz not null default now(),
  deleted_at timestamptz -- null이면 정상, 값이 있으면 유저가 삭제한 것 (소프트 삭제 — 관리자 통계가 삭제 시점과 무관하게 정확히 집계되도록 실제로 행을 지우지 않는다)
);

-- 이미 만들어진 테이블에 새 컬럼을 추가하는 경우를 위한 안전한 재실행용 구문
alter table interview_sessions add column if not exists job_role text;
alter table interview_sessions add column if not exists resume_content text;
alter table interview_sessions add column if not exists portfolio_content text;
alter table interview_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table interview_sessions add column if not exists deleted_at timestamptz;

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
  day_ago timestamptz := now() - interval '1 day';
  week_ago timestamptz := now() - interval '7 days';
  month_ago timestamptz := now() - interval '1 month';

  v_total_users bigint;
  v_total_users_day bigint;
  v_total_users_week bigint;
  v_total_users_month bigint;

  v_total_sessions bigint;
  v_total_sessions_day bigint;
  v_total_sessions_week bigint;
  v_total_sessions_month bigint;

  v_completed bigint;
  v_completed_day bigint;
  v_completed_week bigint;
  v_completed_month bigint;

  v_in_progress bigint;
  v_in_progress_day bigint;
  v_in_progress_week bigint;
  v_in_progress_month bigint;

  -- 신규 가입자는 다른 지표(누적 값)와 달리 애초에 "어떤 기간 동안 새로 생긴 수"라서
  -- 일/주/월 각각 그 기간 자체의 값과, 그 직전 동일 길이 기간의 값을 따로 구한다.
  v_new_users_day bigint; -- 오늘
  v_new_users_day_prev bigint; -- 어제
  v_new_users_week bigint; -- 최근 7일
  v_new_users_week_prev bigint; -- 그 이전 7일
  v_new_users_month bigint; -- 최근 1개월
  v_new_users_month_prev bigint; -- 그 이전 1개월

  v_avg_score numeric;
  v_avg_score_day numeric;
  v_avg_score_week numeric;
  v_avg_score_month numeric;
begin
  if (auth.jwt() ->> 'email') is distinct from 'admin@admin.com' then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  -- 스탯 카드마다 "지금 값"과 "1일/7일/1개월 전 시점 기준으로 같은 방식으로 계산한 값"을 같이
  -- 구해서, 프론트의 일/주/월 토글에 따라 증감률을 계산할 수 있게 한다.
  select count(*) into v_total_users from auth.users;
  select count(*) into v_total_users_day from auth.users where created_at <= day_ago;
  select count(*) into v_total_users_week from auth.users where created_at <= week_ago;
  select count(*) into v_total_users_month from auth.users where created_at <= month_ago;

  select count(*) into v_total_sessions from interview_sessions;
  select count(*) into v_total_sessions_day from interview_sessions where created_at <= day_ago;
  select count(*) into v_total_sessions_week from interview_sessions where created_at <= week_ago;
  select count(*) into v_total_sessions_month from interview_sessions where created_at <= month_ago;

  select count(*) into v_completed from interview_reports;
  select count(*) into v_completed_day from interview_reports where created_at <= day_ago;
  select count(*) into v_completed_week from interview_reports where created_at <= week_ago;
  select count(*) into v_completed_month from interview_reports where created_at <= month_ago;

  -- 진행 중 = 세션은 만들어졌지만 아직 리포트가 없는 경우. 별도 status 컬럼 없이 판단한다.
  select count(*) into v_in_progress
  from interview_sessions s
  where not exists (select 1 from interview_reports r where r.session_id = s.id);

  -- "N 전 시점의 진행 중"은, 그 시점까지 만들어졌는데 그 시점까지는 아직 리포트가 없었던 세션 수.
  select count(*) into v_in_progress_day
  from interview_sessions s
  where s.created_at <= day_ago
    and not exists (select 1 from interview_reports r where r.session_id = s.id and r.created_at <= day_ago);

  select count(*) into v_in_progress_week
  from interview_sessions s
  where s.created_at <= week_ago
    and not exists (select 1 from interview_reports r where r.session_id = s.id and r.created_at <= week_ago);

  select count(*) into v_in_progress_month
  from interview_sessions s
  where s.created_at <= month_ago
    and not exists (select 1 from interview_reports r where r.session_id = s.id and r.created_at <= month_ago);

  select count(*) into v_new_users_day from auth.users where created_at::date = current_date;
  select count(*) into v_new_users_day_prev from auth.users where created_at::date = (current_date - 1);

  select count(*) into v_new_users_week from auth.users where created_at >= week_ago;
  select count(*) into v_new_users_week_prev
  from auth.users where created_at >= (week_ago - interval '7 days') and created_at < week_ago;

  select count(*) into v_new_users_month from auth.users where created_at >= month_ago;
  select count(*) into v_new_users_month_prev
  from auth.users where created_at >= (month_ago - interval '1 month') and created_at < month_ago;

  -- 평균 점수 = "전체 면접의 평균"이 아니라 "유저별 평균의 평균" — 유저 한 명 한 명이 동일한
  -- 비중을 갖도록 한 번 더 평균낸다 (면접을 많이/적게 본 유저가 전체 평균을 과도하게 끌지 않게).
  select avg(user_avg) into v_avg_score
  from (
    select avg(r.overall_score) as user_avg
    from interview_sessions s
    join interview_reports r on r.session_id = s.id
    group by s.user_id
  ) t;

  select avg(user_avg) into v_avg_score_day
  from (
    select avg(r.overall_score) as user_avg
    from interview_sessions s join interview_reports r on r.session_id = s.id
    where r.created_at <= day_ago
    group by s.user_id
  ) t;

  select avg(user_avg) into v_avg_score_week
  from (
    select avg(r.overall_score) as user_avg
    from interview_sessions s join interview_reports r on r.session_id = s.id
    where r.created_at <= week_ago
    group by s.user_id
  ) t;

  select avg(user_avg) into v_avg_score_month
  from (
    select avg(r.overall_score) as user_avg
    from interview_sessions s join interview_reports r on r.session_id = s.id
    where r.created_at <= month_ago
    group by s.user_id
  ) t;

  select jsonb_build_object(
    'total_users', jsonb_build_object(
      'value', v_total_users, 'day', v_total_users_day, 'week', v_total_users_week, 'month', v_total_users_month
    ),
    'total_sessions', jsonb_build_object(
      'value', v_total_sessions, 'day', v_total_sessions_day, 'week', v_total_sessions_week, 'month', v_total_sessions_month
    ),
    'completed_interviews', jsonb_build_object(
      'value', v_completed, 'day', v_completed_day, 'week', v_completed_week, 'month', v_completed_month
    ),
    'in_progress_sessions', jsonb_build_object(
      'value', v_in_progress, 'day', v_in_progress_day, 'week', v_in_progress_week, 'month', v_in_progress_month
    ),
    -- 신규 가입자는 스톡(누적)이 아니라 플로우(기간 동안 발생) 지표라서 모양이 다르다 —
    -- 일/주/월 각각 "그 기간의 값"과 "그 직전 동일 길이 기간의 값"을 쌍으로 준다.
    'new_users', jsonb_build_object(
      'day', jsonb_build_object('value', v_new_users_day, 'previous', v_new_users_day_prev),
      'week', jsonb_build_object('value', v_new_users_week, 'previous', v_new_users_week_prev),
      'month', jsonb_build_object('value', v_new_users_month, 'previous', v_new_users_month_prev)
    ),
    'average_score', jsonb_build_object(
      'value', round(v_avg_score::numeric, 1),
      'day', round(v_avg_score_day::numeric, 1),
      'week', round(v_avg_score_week::numeric, 1),
      'month', round(v_avg_score_month::numeric, 1)
    ),
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
-- 유저가 소프트 삭제한(deleted_at 있는) 세션도 관리자에게는 그대로 보여주고 is_deleted로 표시만 한다
-- (유저 화면에서만 숨겨야 하는 것이지, 관리자 감사 목적으로는 삭제 여부와 무관하게 볼 수 있어야 함).
-- auth.users와는 반드시 LEFT JOIN — 로그인 기능을 붙이기 전(초기 개발 단계)에 만들어진 세션은
-- user_id가 비어있을 수 있는데, INNER JOIN이면 이런 세션들이 통째로 빠져서 admin_dashboard_stats()의
-- 전체 개수(created_at 기준 집계, 유저 매칭과 무관)와 이 목록의 행 수가 안 맞아 보이는 문제가 있었다.
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
      coalesce(admin_mask_email(u.email), '(알 수 없음)') as masked_email,
      s.job_role,
      s.created_at,
      r.overall_score,
      (r.id is not null) as is_completed,
      (s.deleted_at is not null) as is_deleted
    from interview_sessions s
    left join auth.users u on u.id = s.user_id
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
