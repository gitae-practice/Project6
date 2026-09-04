// 관리자 계정 식별 — 이 이메일과 일치해야 /admin 접근이 허용된다.
// 실제 권한 검사(DB 집계 함수 admin_dashboard_stats)는 서버 쪽 Postgres 함수 안에서
// 한 번 더 확인하므로, 여기 값을 바꿔치기해도 DB 쪽 값(schema.sql)까지 같이 바꿔야 실제로 통과된다.
export const ADMIN_EMAIL = "admin@admin.com";
