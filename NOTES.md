# Project6 진행 노트

## 완료된 작업

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

- Supabase 프로젝트 실제 생성 후 `.env.local` 연결 테스트 (계정 생성 진행 중)
- 이력서 / 직무 입력 폼 추가해서 첫 질문에 반영
- 면접 종료 후 구조화된 평가 리포트(JSON, `output_config.format`) 생성 기능
- 로그인(Supabase Auth) 붙이고 RLS 정책을 본인 세션 전용으로 좁히기
- **STT/TTS 음성 입출력** — Web Speech API 사용, 비용 없음. 핵심 플로우(리포트 기능 등) 끝난 뒤 추가 예정
  - STT(`SpeechRecognition`): 음성 답변 → 입력창 텍스트 자동 변환
  - TTS(`SpeechSynthesis`): 면접관 질문 음성으로 읽어주기
  - 주의: STT는 Chrome/Edge 계열만 안정적 지원, Firefox/Safari 불안정 — 데모는 크롬 기준으로
