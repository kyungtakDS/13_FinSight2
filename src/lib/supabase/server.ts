import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing env: ${name}`);
  }
  return value;
}

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies. Middleware refreshes sessions.
          }
        },
      },
    },
  );
}

// 쿠키에 세션이 없으면 supabase-js 는 AuthSessionMissingError 를 error 로 돌려준다.
// 그것은 장애가 아니라 "아직 로그인하지 않았다"는 정상 상태다.
function isMissingSession(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === "AuthSessionMissingError" || code === "session_missing";
}

export async function getUser(): Promise<User | null> {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  // 미인증을 던지면 라우트의 `if (!user) return 401` 에 닿지 못하고 바깥 catch 가
  // 500 으로 바꿔, 로그인하지 않은 요청이 서버 장애로 보고된다.
  // 네트워크 실패·토큰 검증 실패·상류 장애는 그대로 던져 500 이 되게 둔다.
  if (error && !isMissingSession(error)) {
    throw error;
  }
  return user ?? null;
}
