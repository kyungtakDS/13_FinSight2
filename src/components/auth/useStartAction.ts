"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

/** 상류 예외 메시지 대신 사용자에게 보여줄 고정 문구. */
export const START_ERROR_MESSAGE = "로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * 랜딩 CTA 의 공통 동작. "무료로 시작하기"와 "Google로 시작하기"는 라벨만 다르고
 * 눌렀을 때 할 일은 같다 — 로그인했으면 대시보드로, 아니면 Google OAuth 로.
 *
 * 세션 확인은 라우팅 결정일 뿐 인가가 아니다. /dashboard 는 middleware 가 서버에서
 * 막으므로 여기서 틀려도 안전하게 되돌아온다.
 */
export function useStartAction() {
  const [isPending, setIsPending] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  async function start() {
    if (isPending) return;
    setIsPending(true);
    setHasFailed(false);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        // 이동이 시작됐으므로 pending 을 풀지 않는다 — 그 사이 다시 눌리면 안 된다.
        window.location.assign("/dashboard");
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });

      if (error) {
        setHasFailed(true);
        setIsPending(false);
      }
    } catch {
      // createClient 는 NEXT_PUBLIC_* 가 없으면 throw 한다. 여기서 잡지 않으면
      // 버튼이 pending 에 갇혀 아무 설명 없이 멈춘다.
      setHasFailed(true);
      setIsPending(false);
    }
  }

  return { start, isPending, hasFailed };
}
