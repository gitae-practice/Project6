# 오늘의 면접관

기술을 묻고, 사람을 보고, 압박을 견딘다 — 세 명의 AI 면접관과 순서대로 진행하는 모의 면접 웹앱

이직 준비 중 직접 필요해서 만든 프로젝트.
성격이 다른 면접관 세 명이 순서대로 등장해 질문을 던지고, Claude가 실시간 스트리밍으로 답변한다.

## 주요 기능

- **3단계 면접 진행** — 기술 → 인성 → 압박 면접관 순서로 전환
- **실시간 스트리밍 답변** — 면접관 질문이 타이핑되듯 출력
- **대화 기록 DB 저장** — 세션별 질문/답변을 Supabase에 저장
- **라이트 / 다크 테마 토글**

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router) + TypeScript |
| 스타일 | Tailwind CSS v4 |
| 백엔드 | Next.js Route Handler (Node.js 런타임) |
| AI | Anthropic Claude API (`claude-sonnet-5`), 스트리밍 |
| DB | Supabase (PostgreSQL) |

## 실행 방법

```bash
npm install
npm run dev
```

## 환경변수 설정

`.env.local.example`을 복사해 `.env.local` 파일을 만들고 아래 값을 입력.

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## DB 설정

`supabase/schema.sql` 파일을 Supabase SQL Editor에서 실행하면 필요한 테이블이 생성된다.

## 다음 계획

- 이력서 / 직무 정보 입력 후 맞춤 질문 생성
- 면접 종료 후 종합 피드백 리포트 (구조화된 JSON 출력)
- 로그인(Supabase Auth) 붙이고 RLS를 본인 세션 전용 정책으로 좁히기
- 음성 입출력 (STT/TTS, Web Speech API) — 답변을 음성으로 하고 질문을 음성으로 듣기
