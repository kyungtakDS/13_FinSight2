"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Next는 `process.env.NEXT_PUBLIC_FOO` 리터럴만 빌드 시점에 값으로 치환한다.
// 대괄호 인덱싱으로 이름을 넘기는 동적 조회는 치환 대상이 아니므로, 브라우저
// 번들에서는 .env에 값이 있어도 항상 undefined가 된다. 그래서 참조는 반드시
// 정적이어야 하고, 검증은 그 '값'을 받아서 한다 — 이름으로 다시 조회하지 않는다.
function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`missing env: ${name}`);
  }
  return value;
}

export function createClient(): SupabaseClient {
  return createBrowserClient(
    requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  );
}
