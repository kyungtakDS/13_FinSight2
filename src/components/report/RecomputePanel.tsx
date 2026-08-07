"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ERROR_MESSAGES } from "@/components/upload/Dropzone";

type RecomputePanelProps = {
  uploadId: string;
  /** 원본이 남아 있는가. 파기됐으면 재계산할 재료가 없어 버튼을 내지 않는다. */
  canRecompute: boolean;
  /** 서버가 관측한 재계산 진행 여부. */
  recomputing: boolean;
};

const POLL_INTERVAL_MS = 2_000;

function fixedMessage(code: unknown): string {
  return typeof code === "string" && code in ERROR_MESSAGES
    ? ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]
    : ERROR_MESSAGES.analysis_failed;
}

/**
 * StatusPoller 를 쓰지 않는다. 그쪽은 status 가 processing → completed 로 바뀌길
 * 기다리는데, 재계산 중에는 status 가 completed 그대로라 영원히 멈추지 않는다.
 */
export function RecomputePanel({ uploadId, canRecompute, recomputing }: RecomputePanelProps) {
  const { refresh } = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = recomputing || started;

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    const interval = window.setInterval(async () => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/uploads/${uploadId}`);
        if (!response.ok) return;
        const body: unknown = await response.json();
        const result = typeof body === "object" && body !== null
          ? body as Record<string, unknown>
          : {};
        if (result.recomputing === false) {
          stopped = true;
          window.clearInterval(interval);
          setStarted(false);
          refresh();
        }
      } catch {
        // 재계산은 서버에서 계속되므로 다음 주기까지 조용히 기다린다.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [refresh, running, uploadId]);

  async function recompute() {
    if (requesting || running) return;
    setRequesting(true);
    setError(null);
    try {
      const response = await fetch(`/api/uploads/${uploadId}/recompute`, { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const record = typeof body === "object" && body !== null
        ? body as Record<string, unknown>
        : {};
      if (response.status === 202) {
        setStarted(true);
        return;
      }
      setError(fixedMessage(record.error));
    } catch {
      setError(ERROR_MESSAGES.upstream);
    } finally {
      setRequesting(false);
    }
  }

  if (!canRecompute) return null;

  return (
    <section className="fs-card" aria-labelledby="recompute-title">
      <h2 id="recompute-title" className="fs-h">최신 분류 기준으로 다시 계산</h2>
      {error && <p role="alert">{error}</p>}
      {running ? (
        <p className="fs-muted">다시 계산하고 있습니다. 완료될 때까지 기존 결과가 그대로 표시됩니다.</p>
      ) : (
        <button
          type="button"
          className="fs-google"
          disabled={requesting}
          onClick={() => void recompute()}
        >
          다시 계산하기
        </button>
      )}
    </section>
  );
}
