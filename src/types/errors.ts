export const ERROR_CODES = Object.freeze([
  "parse_failed",
  /** 파일은 읽혔지만 거래로 해석된 행이 하나도 없다. `parse_failed` 와 다르다. */
  "rows_unreadable",
  "too_large",
  "duplicate_file",
  "analysis_failed",
  "upstream",
  "expired",
  "payment_required",
] as const);

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === "string" &&
    (ERROR_CODES as readonly string[]).includes(value)
  );
}
