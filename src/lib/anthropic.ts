import Anthropic from "@anthropic-ai/sdk";

// Anthropic API 클라이언트.
// ANTHROPIC_API_KEY 환경변수를 자동으로 읽는다 (.env.local 필요).
// 이 파일은 서버 사이드(Route Handler)에서만 import한다 — 클라이언트 번들에 포함되면 API 키가 노출된다.
export const anthropic = new Anthropic();

// 포트폴리오 프로젝트라 비용 효율이 좋은 Sonnet 5 사용.
// 필요하면 "claude-opus-4-8"로 교체만 하면 됨 (호출 방식은 동일).
export const INTERVIEW_MODEL = "claude-sonnet-5";
