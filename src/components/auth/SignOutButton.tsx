"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    if (isPending) return;
    setIsPending(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setIsPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <button disabled={isPending} onClick={signOut} type="button">
      {isPending ? "로그아웃 중" : "로그아웃"}
    </button>
  );
}
