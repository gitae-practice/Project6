import type { AuthError } from "@supabase/supabase-js";

// Supabase Auth가 영어로 내려주는 에러 메시지를 한글로 바꿔서 보여준다.
// 로그인/회원가입(AuthForm)과 마이페이지(비밀번호 재확인·변경) 양쪽에서 공용으로 쓴다.
//
// 주의: 로그인 실패("Invalid login credentials")는 이메일이 존재하지 않는 경우와
// 비밀번호가 틀린 경우를 구분해서 알려주지 않는다 — 구분해서 알려주면 "이 이메일로
// 가입된 계정이 있는지"를 외부에서 시도해볼 수 있게 되는 계정 유출(user enumeration)
// 취약점이 생기기 때문에 Supabase가 의도적으로 동일한 메시지를 준다. 그래서 여기서도
// "이메일 또는 비밀번호가 올바르지 않습니다"처럼 어느 쪽이 틀렸는지 밝히지 않는다.
export function translateAuthError(error: AuthError): string {
  const message = error.message;
  if (message.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("User already registered")) {
    return "이미 가입된 이메일입니다.";
  }
  if (message.includes("should be different from the old password")) {
    return "새 비밀번호는 기존 비밀번호와 달라야 합니다.";
  }
  if (message.includes("Password should be at least")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (message.includes("Unable to validate email address")) {
    return "올바른 이메일 형식이 아닙니다.";
  }
  if (message.includes("rate limit") || message.includes("only request this after")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  return "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
}
