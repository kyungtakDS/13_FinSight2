export const ERROR_CODES = Object.freeze([
  "parse_failed",
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
