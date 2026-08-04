"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type UploadStatus = "processing" | "completed" | "failed";

type StatusPollerProps = {
  uploadId: string;
  status: UploadStatus;
};

const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 300;

export function StatusPoller({ uploadId, status }: StatusPollerProps) {
  const { refresh } = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status !== "processing") return;
    let polls = 0;
    let stopped = false;
    const interval = window.setInterval(async () => {
      if (stopped) return;
      polls += 1;
      if (polls >= MAX_POLLS) {
        stopped = true;
        window.clearInterval(interval);
        setTimedOut(true);
        return;
      }
      try {
        const response = await fetch(`/api/uploads/${uploadId}`);
        if (!response.ok) return;
        const body: unknown = await response.json();
        const result = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
        if (result.status === "completed" || result.status === "failed") {
          window.clearInterval(interval);
          stopped = true;
          refresh();
        }
      } catch {
        // 분석은 서버에서 계속되므로 다음 폴링 주기까지 조용히 기다린다.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [refresh, status, uploadId]);

  return timedOut ? <p className="fs-muted">예상보다 오래 걸립니다. 새로고침해 주세요</p> : null;
}
