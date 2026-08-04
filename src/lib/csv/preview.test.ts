import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { decodeForPreview, previewCsv } from "./preview";

describe("CSV browser preview", () => {
  it("has no Node-oriented CSV dependencies or Buffer references", () => {
    const source = readFileSync(resolve("src/lib/csv/preview.ts"), "utf8");
    expect(source).not.toMatch(/iconv-lite|papaparse|\bBuffer\b/);
    expect(source).not.toMatch(/^import /m);
  });

  it("decodes UTF-8 and cp949-compatible bytes", () => {
    const utf8 = new TextEncoder().encode("이용일자,가맹점명,이용금액").buffer;
    expect(decodeForPreview(utf8)).toEqual({
      text: "이용일자,가맹점명,이용금액",
      encoding: "utf-8",
    });

    const cp949 = Uint8Array.from([0xc7, 0xd1, 0xb1, 0xdb, 0xc4, 0xab, 0xb5, 0xe5]).buffer;
    expect(decodeForPreview(cp949)).toEqual({ text: "한글카드", encoding: "cp949" });
  });

  it("counts non-empty trailing rows and extracts a likely header", () => {
    const result = previewCsv(
      "신한카드 이용내역\n조회기간,2026-01\n이용일자,가맹점명,이용금액\n2026-01-01,문구점,12000\n",
    );
    expect(result).toMatchObject({
      rowCount: 4,
      headerLabels: ["이용일자", "가맹점명", "이용금액"],
      issuerHint: "신한카드",
    });
  });

  it("returns null when no header candidate exists", () => {
    expect(previewCsv("메모\n한 줄").headerLabels).toBeNull();
  });
});
