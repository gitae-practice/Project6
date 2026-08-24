import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 서버 컴포넌트 / Route Handler에서 사용하는 Supabase 클라이언트.
// Next.js 쿠키 저장소와 연결해 로그인 세션을 서버에서도 읽을 수 있게 한다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component 내부에서는 쿠키 쓰기가 막혀있다.
            // 세션 갱신은 미들웨어가 담당하므로 여기서는 무시해도 안전하다.
          }
        },
      },
    }
  );
}
