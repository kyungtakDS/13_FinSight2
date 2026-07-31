"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

export function GoogleSignInButton() {
  const [isPending, setIsPending] = useState(false);

  async function signIn() {
    if (isPending) return;
    setIsPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setIsPending(false);
    }
  }

  return (
    <button
      className="fs-google"
      disabled={isPending}
      onClick={signIn}
      type="button"
    >
      <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20">
        <path
          d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
          fill="currentColor"
        />
        <path
          d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"
          fill="currentColor"
        />
        <path
          d="M6.5 14.1a6 6 0 0 1 0-4.2V7.3H3.2a10 10 0 0 0 0 9.4l3.3-2.6Z"
          fill="currentColor"
        />
        <path
          d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.2 7.3l3.3 2.6A5.8 5.8 0 0 1 12 5.9Z"
          fill="currentColor"
        />
      </svg>
      {isPending ? "로그인 중" : "Google로 시작하기"}
    </button>
  );
}
