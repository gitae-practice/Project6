# Project6 진행 노트

## 완료된 작업

### 2026-08-26
- Supabase Auth 로그인/회원가입 추가 (AuthForm, LogoutButton), page.tsx에서 서버 사이드로 로그인 분기
- Next.js 16 대응: middleware.ts → proxy.ts로 전환 (파일명/함수명만 변경, 기능 동일) — 세션 쿠키 자동 갱신
- interview_sessions에 user_id 컬럼 추가, RLS를 "본인 세션만" 정책으로 전면 교체
- 세 API 라우트(/api/interview, /extract-resume, /report) 전부 인증 체크 추가 — 비로그인 직접 호출 401 확인
- curl로 비로그인 상태 API 차단 + 홈 화면 로그인 폼 렌더링 검증 완료
- 남은 확인: 실제 회원가입→로그인→면접 진행→DB user_id 저장까지는 브라우저에서 직접 테스트 필요 (이메일 확인 설정에 따라 흐름이 달라질 수 있음)

### 2026-08-25 (계속 2)
- PDF 업로드 구조 재설계: 추출 내용을 텍스트박스에 넣지 않고 `resumeFileText`로 별도 보관, 수기 입력(`resumeContent`)과는 완전히 분리
- 면접관에게는 두 소스를 합친 `combinedResumeContent`를 전달 — 실제로 수기 입력+PDF 내용 둘 다 반영되는지 curl로 검증 완료 (두 정보의 차이까지 짚어서 질문함)
- "시작하기" 버튼을 이력서 분석 중(isExtractingResume)에는 비활성화 — 분석 완료 후에만 면접 시작 가능
- 컬럼명 resume_summary → resume_content 변경, Supabase RENAME COLUMN + PostgREST 스키마 캐시 이슈 대응(NOTIFY pgrst 안내)

### 2026-08-25 (계속)
- 버그 수정: job_role/resume_summary 컬럼을 Supabase에 반영 안 해서 /api/interview 500 에러 나던 문제 — schema.sql 재실행으로 해결
- 프론트: 서버 에러(non-ok 응답, 스트리밍 도중 에러) 발생 시 채팅창에 바로 표시하도록 개선 (이전엔 조용히 멈춤)
- 이력서 PDF 업로드 기능 추가 — `/api/interview/extract-resume`, Claude의 document 입력으로 직접 읽음 (OCR 라이브러리 불필요), 업로드하면 이력서 요약 칸이 자동으로 채워짐 (수정 가능)
- 핸드메이드 테스트 PDF로 추출 기능 실제 검증 완료

### 2026-08-25
- 이력서/직무 입력 폼 추가 (시작 화면, 선택 입력) — 입력 시 첫 질문 kickoff 메시지에 반영
- 면접관 전환 시 sessionId를 새로 만들지 않고 유지하도록 변경 (세션 하나 = 면접 한 판 전체)
- interview_sessions에 job_role/resume_summary 컬럼 추가
- `/api/interview/report` 신규 — zod 스키마 + `output_config.format`으로 구조화된 평가 리포트 생성 (종합점수/총평/면접관별피드백/강점/보완점)
- "면접 마치기" 클릭 시 자동으로 리포트 생성 → 종료 화면에 카드로 표시
- 실제 curl 테스트로 리포트 API 정상 작동 확인
- Vercel 배포는 후순위로 미루기로 결정 (코드에 영향 없음, 사용자 확인됨)
- next.config.ts에 devIndicators: false 추가 (개발 모드 좌하단 N 배지 제거)

### 2026-08-24 (계속)
- 엔드투엔드 실사용 테스트 완료 — Anthropic API 결제 후 실제 스트리밍 호출, Supabase insert까지 curl로 검증
- Supabase "Automatically expose new tables" 꺼둔 상태라 anon 권한 GRANT 별도 실행 필요했음 (schema.sql에 반영)
- 버그: "다음 면접관으로" 전환 시 첫 질문을 안 받아와서 화면이 비어 보이던 문제 수정 (`startInterviewer` 공용 함수로 리팩터링)
- 브랜딩: 여러 후보(3개의 관문, 면접관은 셋 등) 검토 후 "오늘의 면접관"으로 확정, 부제 "기술을 묻고, 사람을 보고, 압박을 견딘다"
- 면접 종료 화면에 "홈으로 돌아가기" 버튼 추가

### 2026-08-24
- Next.js(App Router) + TypeScript + Tailwind CSS v4로 프로젝트 스캐폴딩
- 웜 뉴트럴 + 테라코타 포인트 컬러 디자인 시스템 적용, 라이트/다크 토글 구현
  - `ThemeToggle`은 React state 대신 ref로 DOM 직접 조작 — set-state-in-effect 린트 규칙 위반 및 하이드레이션 불일치 방지
- Supabase 클라이언트(브라우저용 `lib/supabase/client.ts`, 서버용 `lib/supabase/server.ts`) 작성
- `interview_sessions` / `interview_messages` 테이블 스키마 작성 (`supabase/schema.sql`), 현재는 RLS 전체 허용 정책(임시)
- Anthropic Claude API(`claude-sonnet-5`) 연동 — 면접관 3명(기술/인성/압박) 역할별 system prompt 분리 (`lib/interview/roles.ts`)
- `/api/interview` Route Handler — Claude 스트리밍 응답을 SSE로 중계 + 완료 시 Supabase에 대화 기록 저장
- 프론트 `InterviewChat` 컴포넌트 — 면접관 순회 UI, 실시간 스트리밍 렌더링, 반응형 레이아웃
- lint / 타입체크 / 프로덕션 빌드 통과 확인

## 다음 할 일

- **유저별 면접 히스토리 (다음 세션 최우선)** — "지난 면접 때는 어땠는지" 돌아볼 수 있게
  - `interview_reports` 테이블 신규: session_id(unique, FK) / overall_score / summary / interviewer_feedback(jsonb) / strengths(text[]) / improvements(text[]) / created_at
  - RLS: session_id로 interview_sessions 소유권 확인하는 방식 (메시지 테이블과 동일 패턴)
  - `/api/interview/report`가 sessionId도 받아서 생성한 리포트를 이 테이블에 upsert하도록 수정 (지금은 화면에 한 번 보여주고 버려짐)
  - `InterviewChat.tsx`의 리포트 생성 호출부에서 `sessionId` 같이 전송하도록 수정
  - `/history` 목록 페이지 — 로그인한 유저의 지난 세션들(날짜, 지원 직무, 점수) 나열
  - `/history/[id]` 상세 페이지 — 리포트 카드 + 전체 대화 내역
  - 헤더에 "지난 기록" 이동 링크 추가
  - (2026-08-26에 한 번 만들었다가 오늘 안에 못 끝내서 원복함 — schema.sql은 현재 리포트 테이블 없는 상태)
- STT/TTS 음성 입출력 (Web Speech API, 브라우저 무료, Chrome/Edge만 안정적)
  - STT(`SpeechRecognition`): 음성 답변 → 입력창 텍스트 자동 변환
  - TTS(`SpeechSynthesis`): 면접관 질문 음성으로 읽어주기
  - 주의: STT는 Chrome/Edge 계열만 안정적 지원, Firefox/Safari 불안정 — 데모는 크롬 기준으로
- Vercel 배포 (최후순위로 미뤄둠)
