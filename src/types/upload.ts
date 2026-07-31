import type { ErrorCode } from "./errors";
import type { UploadSummary } from "./report";

export const UPLOAD_STATUSES = Object.freeze([
  "processing",
  "completed",
  "failed",
] as const);

export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

/** uploads 테이블의 행. */
export interface UploadRow {
  id: string;
  userId: string;
  storagePath: string;
  filename: string | null;
  fileHash: string;
  status: UploadStatus;
  errorCode: ErrorCode | null;
  retryCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  rowCount: number | null;
  summary: UploadSummary | null;
  expiresAt: string;
  createdAt: string;
  startedAt: string;
  finishedAt: string | null;
}

/** 과거 업로드 목록에 필요한 식별 정보. */
export type UploadListItem = Pick<
  UploadRow,
  | "id"
  | "filename"
  | "status"
  | "errorCode"
  | "periodStart"
  | "periodEnd"
  | "rowCount"
  | "expiresAt"
  | "createdAt"
>;
