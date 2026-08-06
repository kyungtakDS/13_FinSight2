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
 * 좁히지 못하므로 서버 쪽 기록을 따로 둔다. 이 값은 클라이언트로 내보내지 않는다.
 *
 * 메시지·본문·힌트는 담지 않는다 — 상류 오류와 DB 오류 모두 요청 내용이나 행
 * 값을 그대로 되비칠 수 있다. 남기는 것은 분류·코드·이름·식별자뿐이다.
 *
 * `source` 가 있어야 "Claude 장애"와 "우리 쪽 DB·코드 오류"를 구분할 수 있다.
 * `errorCode` 는 둘 다 `upstream` 으로 뭉뚱그리기 때문이다.
 */
export interface UploadErrorDetail {
  source: "claude" | "database" | "internal";
  stage: string;
  errorName: string | null;
  status: number | null;
  errorType: string | null;
  requestId: string | null;
  retryable: boolean;
  /**
   * JSON 이 아닌 Claude 응답의 형태. 코드 펜스인지 설명문인지 빈 응답인지를
   * 원문 없이 가른다 — 응답에는 물어본 값이 그대로 되비쳐 나오기 때문이다.
   */
  responseShape?: {
    textLength: number;
    startsWithFence: boolean;
    firstCharKind: string;
    stopReason: string | null;
  };
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
