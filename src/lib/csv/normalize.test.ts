import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import type { ColumnMap } from "@/types/csv";

import {
  RowLimitExceeded,
  decodeCsv,
  detectEncoding,
  normalizeMerchant,
  normalizeRows,
  parseAmount,
  parseRows,
  parseTxnDate,
} from "./normalize";

describe("detectEncoding", () => {
  it("detects UTF-8 Korean bytes", () => {
    expect(detectEncoding(Buffer.from("이용일자", "utf8"))).toBe("utf-8");
  });

  it("detects cp949 Korean bytes", () => {
    expect(detectEncoding(iconv.encode("이용일자", "cp949"))).toBe("cp949");
  });

  it("detects UTF-8 with a BOM", () => {
    expect(
      detectEncoding(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("상호")])),
    ).toBe("utf-8");
  });

  it("defaults ASCII-only bytes to UTF-8", () => {
    expect(detectEncoding(Buffer.from("date,merchant,amount"))).toBe("utf-8");
  });
});

describe("decodeCsv", () => {
  it("removes a UTF-8 BOM", () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("이용일자,가맹점"),
    ]);

    expect(decodeCsv(bytes, "utf-8")).toBe("이용일자,가맹점");
  });

  it("decodes cp949 extension syllables without corruption", () => {
    const source = "똠,뷁";
    expect(decodeCsv(iconv.encode(source, "cp949"), "cp949")).toBe(source);
  });
});

describe("parseRows", () => {
  it("keeps a quoted merchant containing a comma in one cell", () => {
    expect(parseRows('"스타벅스 강남,2호점",10000')).toEqual([
      ["스타벅스 강남,2호점", "10000"],
    ]);
  });

  it("preserves rows with differing cell counts", () => {
    expect(parseRows("카드 명세서\n조회기간,2025년\n날짜,가맹점,금액")).toEqual([
      ["카드 명세서"],
      ["조회기간", "2025년"],
      ["날짜", "가맹점", "금액"],
    ]);
  });

  it("does not create a row for a trailing blank line", () => {
    expect(parseRows("날짜,금액\n2025-03-14,1000\n\n")).toHaveLength(2);
  });
});

describe("parseAmount", () => {
  it.each([
    ["10,000", 10_000],
    ["₩10,000", 10_000],
    ["10,000원", 10_000],
    ["-8,900", -8_900],
    ["(8,900)", -8_900],
    ["△8,900", -8_900],
    ["▲8,900", -8_900],
    ["10,000.00", 10_000],
  ])("parses %s", (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });

  it.each(["", "   ", "-"])("returns null for an empty amount %j", (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });

  it("returns null outside the safe integer range", () => {
    expect(parseAmount("9007199254740992")).toBeNull();
  });
});

describe("parseTxnDate", () => {
  it.each([
    "2025.03.14",
    "2025-03-14",
    "2025/03/14",
    "20250314",
    "2025.03.14 13:22:01",
  ])("normalizes %s", (raw) => {
    expect(parseTxnDate(raw)).toBe("2025-03-14");
  });

  it("returns null for an invalid date", () => {
    expect(parseTxnDate("2025-02-30")).toBeNull();
    expect(parseTxnDate("날짜 없음")).toBeNull();
  });
});

describe("normalizeMerchant", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeMerchant("  스타벅스\t 강남점  ")).toBe("스타벅스 강남점");
  });

  it("removes a masked card-number pattern", () => {
    expect(normalizeMerchant("스타벅스 1234-56**-****-7890 강남점")).toBe(
      "스타벅스 강남점",
    );
  });

  it("preserves source casing and Korean text", () => {
    expect(normalizeMerchant("  iHerb 서울점  ")).toBe("iHerb 서울점");
  });
});

describe("normalizeRows", () => {
  const map: ColumnMap = {
    date: 0,
    merchant: 1,
    amount: 2,
    txnType: 5,
  };

  it("ignores metadata above the header and the header itself", () => {
    const result = normalizeRows(
      [
        ["카드 이용 명세서"],
        ["조회기간", "2025년 3월"],
        ["날짜", "가맹점", "금액"],
        ["2025-03-14", "문구점", "10000"],
      ],
      map,
      2,
    );

    expect(result.txns).toEqual([
      {
        rowIndex: 3,
        txnDate: "2025-03-14",
        merchant: "문구점",
        amount: 10_000,
      },
    ]);
  });

  it("reads only mapped transaction fields and preserves cancellation signs", () => {
    const result = normalizeRows(
      [
        ["날짜", "가맹점", "금액", "카드번호", "승인번호", "구분"],
        [
          "2025-03-14",
          "문구점",
          "(8,900)",
          "1234-56**-****-7890",
          "99887766",
          "취소",
        ],
      ],
      map,
      0,
    );

    expect(result.txns[0]).toEqual({
      rowIndex: 1,
      txnDate: "2025-03-14",
      merchant: "문구점",
      amount: -8_900,
    });
    expect(Object.keys(result.txns[0] ?? {})).toEqual([
      "rowIndex",
      "txnDate",
      "merchant",
      "amount",
    ]);
  });

  it("skips invalid rows, counts them, and retains source row indexes", () => {
    const result = normalizeRows(
      [
        ["날짜", "가맹점", "금액"],
        ["날짜 아님", "문구점", "1000"],
        ["2025-03-14", "식당", "-"],
        ["2025-03-15", "카페", "5500"],
      ],
      map,
      0,
    );

    expect(result).toEqual({
      txns: [
        {
          rowIndex: 3,
          txnDate: "2025-03-15",
          merchant: "카페",
          amount: 5_500,
        },
      ],
      skipped: 2,
    });
  });

  it("throws RowLimitExceeded for more than 3,000 transaction rows", () => {
    const rows = [
      ["날짜", "가맹점", "금액"],
      ...Array.from({ length: 3_001 }, (_, index) => [
        "2025-03-14",
        `합성가맹점 ${index}`,
        "1000",
      ]),
    ];

    expect(() => normalizeRows(rows, map, 0)).toThrow(RowLimitExceeded);
  });
});
