"use client";

import { useState } from "react";

import { ERROR_MESSAGES } from "@/components/upload/Dropzone";

import { ProcessingPanel } from "./ProcessingPanel";
import { StatusPoller } from "./StatusPoller";

type FailedPanelProps = {
  uploadId: string;
  errorCode: string | null;
  retriesLeft: number;
};

function fixedMessage(code: unknown): string {
  return typeof code === "string" && code in ERROR_MESSAGES
    ? ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]
    : "분석에 실패했습니다";
}

export function FailedPanel({ uploadId, errorCode, retriesLeft }: FailedPanelProps) {
  const [retrying, setRetrying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  async function retry() {
    if (retrying || retriesLeft === 0 || errorCode === "expired") return;
    setRetrying(true);
    setRetryError(null);
    try {
      const response = await fetch(`/api/uploads/${uploadId}/retry`, { method: "POST" });
      const body: unknown = await response.json().catch(() => null);
      const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      if (response.status === 202) {
        setProcessing(true);
        return;
      }
      setRetryError(fixedMessage(record.error === "expired" ? "expired" : record.error));
    } catch {
      setRetryError(ERROR_MESSAGES.upstream);
    } finally {
      setRetrying(false);
    }
  }

  if (processing) {
    return <><ProcessingPanel /><StatusPoller uploadId={uploadId} status="processing" /></>;
  }

  const expired = errorCode === "expired";
  return (
    <section className="fs-card" aria-labelledby="analysis-failed-title">
      <span className="fs-eyebrow">분석 실패</span>
      <h1 id="analysis-failed-title" className="fs-page-title">분석을 완료하지 못했습니다</h1>
      <p>{fixedMessage(errorCode)}</p>
      {retryError && <p role="alert">{retryError}</p>}
      {expired ? (
        <p className="fs-muted">원본이 만료되어 재시도할 수 없습니다</p>
      ) : (
        <>
          <button
            type="button"
            className="fs-google"
            disabled={retrying || retriesLeft === 0}
            onClick={() => void retry()}
          >
            {retrying ? "재시도 요청 중" : `재시도 · ${retriesLeft}회 남음`}
          </button>
          {retriesLeft === 0 && <p className="fs-muted">재시도 횟수를 모두 사용했습니다.</p>}
        </>
      )}
    </section>
  );
}
