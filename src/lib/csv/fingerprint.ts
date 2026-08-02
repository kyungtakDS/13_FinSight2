import { createHash } from "node:crypto";

export const FINGERPRINT_ROWS = 20;

const ROW_SEPARATOR = "\u0001";
const CELL_SEPARATOR = "\u0002";
const KOREAN_OR_ENGLISH = /[A-Za-z\u3131-\u318e\uac00-\ud7a3]/u;

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function maskCell(value: string): string {
  return value.replace(/\d/gu, "#").trim().replace(/\s+/gu, " ");
}

function isNumericCell(masked: string): boolean {
  return masked.includes("#") && !KOREAN_OR_ENGLISH.test(masked);
}

export function fileHash(bytes: Uint8Array): string {
  return sha256(bytes);
}

export function headerFingerprint(rows: string[][]): string {
  const fingerprintInput = rows
    .slice(0, FINGERPRINT_ROWS)
    .map((row) => {
      const maskedCells = row.map(maskCell);
      const isDataRow =
        maskedCells.filter((cell) => isNumericCell(cell)).length >= 2;
      const textCells = isDataRow
        ? []
        : maskedCells.filter(
            (cell) => cell !== "" && KOREAN_OR_ENGLISH.test(cell),
          );

      return [String(row.length), ...textCells].join(CELL_SEPARATOR);
    })
    .join(ROW_SEPARATOR);

  return sha256(fingerprintInput);
}
