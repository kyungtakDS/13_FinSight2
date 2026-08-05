import type { ErrorCode } from "./errors";
import type { UploadSummary } from "./report";

export const UPLOAD_STATUSES = Object.freeze([
  "processing",
  "completed",
  "failed",
] as const);

export type UploadStatus = (typeof UPLOAD_STATUSES)[number];

/**
 * 실패 원인의 진단 정보. `errorCode` 는 클라이언트로 나가는 고정 어휘라 원인을
 * 좁히지 못하므로 서버 쪽 기록을 따로 둔다. 상류 메시지·본문은 담지 않는다.
 * 이 값은 클라이언트로 내보내지 않는다.
 */
export interface UploadErrorDetail {
  status: number | null;
  errorType: string | null;
  requestId: string | null;
  retryable: boolean;
}

/** uploads 테이블의 행. */
export interface UploadRow {
  id: string;
  userId: string;
  storagePath: string;
  filename: string | null;
  fileHash: string;
  status: UploadStatus;
  errorCode: ErrorCode | null;
  errorDetail: UploadErrorDetail | null;
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
