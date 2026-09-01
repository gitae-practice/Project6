# Project6 진행 노트

## 완료된 작업

### 2026-08-31 (계속)
- **로그인/회원가입 에러 메시지 한글화**
  - Supabase Auth 에러(`Invalid login credentials`, `User already registered` 등)를 `translateAuthError()`로 매핑해 한글로 표시
  - ID/PW 중 어느 쪽이 틀렸는지는 의도적으로 구분하지 않음 — 구분하면 특정 이메일의 가입 여부를 외부에서 알아낼 수 있는 계정 유출(user enumeration) 취약점이 생기기 때문에 Supabase가 원래도 동일한 메시지를 주는 것 (보안 설계를 그대로 존중)
- **리포트 PDF 다운로드**
  - `ReportWithDownload` 컴포넌트 신규 — `ReportCard`를 감싸서 "PDF로 다운로드" 버튼 제공, 면접 종료 화면/`/history/[id]` 상세 페이지 둘 다에서 재사용
  - html2canvas로 화면에 실제 렌더링된 카드를 캡처 → jsPDF로 캡처 크기 그대로 한 페이지 PDF 생성 (A4 강제 맞춤 없이 잘림 방지)
  - 텍스트 기반 PDF(@react-pdf/renderer 등) 대신 스크린샷 방식을 택한 이유: 한글 폰트를 PDF 라이브러리에 별도로 임베드할 필요 없이 현재 테마/디자인을 그대로 재사용할 수 있어서
  - html2canvas/jsPDF는 다운로드 버튼을 누를 때만 동적 import로 불러와 초기 번들 크기에 영향 없음 (빌드 청크 분리 확인)
  - tsc/lint/build 전부 통과 확인

### 2026-08-31
- **지원 직무 필수화 + 이력서 입력 검증 (토큰 낭비 방지)**
  - `canStart = jobRole 있음 && (PDF 추출 텍스트 또는 수기 입력 중 하나 있음) && 분석 중 아님`으로 게이팅
  - "시작하기" 버튼을 `canStart` 기준으로 disabled 처리, 불충족 시 안내 문구 노출
  - 라벨/힌트 텍스트를 "(선택)" → "(필수)"로 변경, PDF/텍스트 둘 중 하나만 있으면 된다는 안내 추가
  - `buildKickoffMessage()`는 이제 직무/이력서가 항상 존재한다고 가정하도록 단순화 (기존 "둘 다 없을 때" 분기 제거 — canStart가 막아주므로 도달 불가능해진 코드)
  - tsc/lint/build 전부 통과 확인
- **히스토리 기록 삭제 기능**
  - `HistorySidebar`의 각 항목 옆에 휴지통 버튼 추가, `window.confirm` 확인 후 `interview_sessions` 행 삭제
  - 스키마에 이미 `on delete cascade`(메시지/리포트)와 `delete_own_sessions` RLS 정책, GRANT delete가 되어 있어서 스키마 변경 없이 프론트만 추가하면 됐음
  - 보고 있던 기록을 삭제하면 홈으로 이동 + `router.refresh()`로 목록 즉시 갱신
- **회원가입 시 실명 입력 → 면접관이 이름 참고**
  - `AuthForm` 회원가입 모드에만 "이름" 입력란 추가, `supabase.auth.signUp`의 `options.data.full_name`(user_metadata)에 저장 — 별도 테이블/스키마 변경 없음
  - `/api/interview` route에서 매 요청마다 `user.user_metadata.full_name`을 읽어 시스템 프롬프트에 "지원자의 이름은 OOO입니다" 문구로 주입
- **로그인 화면 모바일 브랜딩 슬라이드**
  - 브랜딩 패널을 `hidden md:flex`로 완전히 숨기던 것을 없애고, CSS `scroll-snap`만으로 모바일 2패널(브랜딩→폼) 스와이프 캐러셀 구현 (별도 제스처 라이브러리 없이 네이티브 터치 스크롤 사용)
  - md 이상에서는 `md:snap-none md:overflow-visible`로 되돌려 기존 고정 2열 레이아웃 그대로 유지
  - 모바일 브랜딩 슬라이드 하단에 "옆으로 밀어 로그인하기" 힌트 텍스트 추가 (스와이프 발견성 문제 방지)
  - 폼 마크업을 두 번 두지 않고 하나만 유지해서 중복 id 문제 없이 구현
- 위 1~4 항목 전부 tsc/lint/build 통과 확인

### 2026-08-29
- **유저별 면접 히스토리 기능 완성**
  - `interview_reports` 테이블 신규 추가 (session_id unique FK / overall_score / summary / interviewer_feedback jsonb / strengths / improvements), RLS+GRANT까지 schema.sql 반영
  - `/api/interview/report`가 sessionId를 받아 생성한 리포트를 upsert로 저장하도록 수정
  - 로그인 후 화면 전체가 `(dashboard)` 라우트 그룹으로 재구성: `layout.tsx`(인증 분기 + 좌측 사이드바 조회), `page.tsx`(새 면접), `history/[id]/page.tsx`(지난 기록 상세 — 리포트 카드 + 전체 대화)
  - `HistorySidebar` — 로그인 직후부터 항상 왼쪽에 떠 있는 지난 기록 목록, 리포트 있는 세션만 노출
  - PostgREST 임베드가 배열/단일객체 둘 다로 올 수 있어 `firstReport()` 헬퍼로 방어 처리
  - tsc/lint/build 전부 통과 확인
- **디자인 전면 리뉴얼** (기능 로직은 그대로, 스타일만 교체)
  - 순수 중립 팔레트(라이트 #fafafa / 다크 #0a0a0a)로 변경, 오렌지(#f97316) 포인트 컬러로 통일
  - 카드/패널 공통 glassmorphism 적용 (`globals.css`의 `.glass-card` — foreground 기준 color-mix라 라이트/다크 모두 자연스럽게 동작)
  - 로그인 화면: 좌(브랜딩+면접관 3인 뱃지) / 우(폼) 2열 레이아웃으로 재구성
  - 홈 화면: 그라데이션 타이틀 + 면접관 3인 미리보기 카드(기술=blue/인성=green/압박=red, 순차 fade-in)
  - 면접 진행 화면: pill 3개 → 체크 아이콘이 채워지는 스텝 프로그레스 바, 면접관 헤더에 역할별 글로우, 하단 입력바 프로스티드 스티키 처리
  - 리포트 화면: 단일 카드 → Bento grid(점수 링/총평/면접관별 피드백 3칸/강점·보완점)로 재구성, 점수 구간별(초록/주황/빨강) 색상 연동
  - 역할별 아이콘/색상을 `roles.ts`의 `INTERVIEWER_ICON`/`INTERVIEWER_ACCENT`로 중앙화 (Tailwind가 소스에 리터럴로 없는 클래스는 생성 못 하는 문제 때문에 `hover:bg-blue-400` 같은 조합형 클래스도 전부 완성된 문자열로 미리 정의)
  - Tailwind 사용 상태 점검: 인라인 style 전무, `globals.css` 하나로만 관리되는 것 확인 — 별도 정리 불필요
  - 프로덕션 빌드 CSS에서 신규 클래스(`hover:bg-blue-400` 등) 실제 생성 여부까지 grep으로 검증

### 2026-08-29 (계속)
- **모바일 반응형 레이아웃 수정**
  - 타이틀/서브타이틀 폰트 반응형(`text-3xl md:text-4xl lg:text-5xl`), 전반적인 패딩/여백 모바일 축소
  - 사이드바를 모바일에서 드로어로 전환 — `DashboardChrome` 클라이언트 컴포넌트가 햄버거 버튼+오버레이+열림 상태를 관리, `HistorySidebar`는 isOpen/onClose props로 열림 애니메이션만 담당
  - 면접관 3인 미리보기 카드: 모바일 가로 배치, md 이상 세로 배치
  - 스텝 인디케이터: 모바일에서 라벨 숨기고 순번만 표시
  - 리포트 Bento grid, 로그인 2열 레이아웃 브레이크포인트를 sm→md로 통일
  - 홈 화면 입력 폼 카드 너비를 면접관 3인 카드 줄 너비(max-w-2xl)에 맞춤
  - 지난 기록 상세 페이지의 대화 말풍선 폭(85% 제한)을 위쪽 리포트 Bento grid와 맞춰 컨테이너 전체 폭으로 변경
- **기본 테마 다크모드 + 로그인 화면 테마 토글 + 토글 버튼 크기 조정**
  - `ThemeToggle` 기본값을 다크로 고정 (localStorage에 저장된 값이 있으면 그 값 우선) — 처음엔 라이트로 잘못 적용했다가 다크로 정정
  - 로그인 화면(`AuthForm`)은 별도 헤더가 없어 토글이 아예 없었음 — 우측 상단에 고정 배치로 추가
  - 토글/로그아웃/햄버거 버튼이 작아서 잘 안 보인다는 피드백 반영 — h-9→h-11로 확대 (아이콘도 h-4→h-5)

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

- STT/TTS 음성 입출력 (Web Speech API, 브라우저 무료, Chrome/Edge만 안정적)
  - STT(`SpeechRecognition`): 음성 답변 → 입력창 텍스트 자동 변환
  - TTS(`SpeechSynthesis`): 면접관 질문 음성으로 읽어주기
  - 주의: STT는 Chrome/Edge 계열만 안정적 지원, Firefox/Safari 불안정 — 데모는 크롬 기준으로
- Vercel 배포 (최후순위로 미뤄둠)
