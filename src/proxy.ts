import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 모든 요청마다 Supabase 세션 쿠키를 갱신한다.
// 이게 없으면 액세스 토큰이 만료됐을 때 서버 컴포넌트/Route Handler에서
// 로그인 상태를 제대로 못 읽는 경우가 생긴다.
// Next.js 16부터 이 파일은 "middleware.ts"가 아니라 "proxy.ts"로 명명한다 (기능은 동일).
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 세션 만료 여부를 확인하고 필요하면 토큰을 갱신한다 (반환값은 안 써도 호출 자체가 필요함).
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
