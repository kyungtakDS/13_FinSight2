"use client";

import Link from "next/link";
import { useState } from "react";

import { ERROR_MESSAGES } from "./Dropzone";
import { EmptyState } from "./EmptyState";

type UploadStatus = "processing" | "completed" | "failed";
type ErrorCode = keyof typeof ERROR_MESSAGES;

export interface UploadListItem {
  id: string;
  filename: string | null;
  status: UploadStatus;
  error_code: string | null;
  period_start: string | null;
  period_end: string | null;
  row_count: number | null;
  expires_at: string;
  created_at: string;
}

interface UploadListProps {
  uploads: UploadListItem[];
  now?: Date;
}

function isErrorCode(value: string | null): value is ErrorCode {
  return value !== null && value in ERROR_MESSAGES;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ko-KR");
}

function periodLabel(upload: UploadListItem): string {
  if (!upload.period_start || !upload.period_end) return "기간 분석 중";
  return `${formatDate(upload.period_start)} ~ ${formatDate(upload.period_end)}`;
}

function statusLabel(status: UploadStatus): string {
  if (status === "processing") return "진행 중";
  if (status === "completed") return "완료";
  return "실패";
}

export function UploadList({ uploads: initialUploads, now = new Date() }: UploadListProps) {
  const [uploads, setUploads] = useState(initialUploads);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (uploads.length === 0) return <EmptyState />;

  const confirmingUpload = uploads.find((upload) => upload.id === confirmingId);

  async function deleteUpload(id: string) {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code = typeof body === "object" && body !== null && "error" in body
          ? String(body.error)
          : null;
        setError(ERROR_MESSAGES[isErrorCode(code) ? code : "upstream"]);
        return;
      }
      setUploads((current) => current.filter((upload) => upload.id !== id));
      setConfirmingId(null);
    } catch {
      setError(ERROR_MESSAGES.upstream);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section aria-labelledby="upload-history-title">
      <span className="fs-eyebrow">업로드 기록</span>
      <h2 id="upload-history-title" className="fs-page-title">과거 분석</h2>
      {error && <p role="alert">{error}</p>}
      <div className="fs-tablewrap">
        <table className="fs-table">
          <thead>
            <tr>
              <th scope="col">분석 기간</th>
              <th scope="col">거래 수</th>
              <th scope="col">상태</th>
              <th scope="col">파일</th>
              <th scope="col">관리</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => {
              const label = periodLabel(upload);
              const expired = new Date(upload.expires_at).getTime() < now.getTime();
              return (
                <tr key={upload.id}>
                  <td><Link href={`/dashboard/uploads/${upload.id}`}>{label}</Link></td>
                  <td className="num">{upload.row_count === null ? "—" : `${upload.row_count.toLocaleString("ko-KR")}건`}</td>
                  <td>
                    <span className="fs-chip">{statusLabel(upload.status)}</span>
                    {upload.status === "failed" && (
                      <p className="fs-muted">
                        {ERROR_MESSAGES[isErrorCode(upload.error_code) ? upload.error_code : "analysis_failed"]}
                      </p>
                    )}
                    {expired && <p className="fs-muted">원본 만료 — 재시도 불가</p>}
                  </td>
                  <td className="fs-muted">{upload.filename ?? "파일명 없음"}</td>
                  <td>
                    <button
                      type="button"
                      className="fs-google"
                      aria-label={`${upload.filename ?? label} 업로드 삭제`}
                      onClick={() => { setError(null); setConfirmingId(upload.id); }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmingUpload && (
        <div className="fs-scrim">
          <section className="fs-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">이 업로드를 삭제할까요?</h3>
            <p>원본 파일과 분석 내역이 함께 삭제됩니다. 삭제한 내용은 복구할 수 없습니다.</p>
            <button type="button" className="fs-google" disabled={deleting} onClick={() => void deleteUpload(confirmingUpload.id)}>
              {deleting ? "삭제 중" : "삭제하기"}
            </button>
            <button type="button" className="fs-google" disabled={deleting} onClick={() => setConfirmingId(null)}>
              취소
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
