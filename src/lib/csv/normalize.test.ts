import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";

import { aggregate } from "@/lib/report/aggregate";
import type { ColumnMap } from "@/types/csv";
import type { ClassifiedTxn } from "@/types/transaction";

import {
  MAX_STATUS_VALUES,
  RowLimitExceeded,
  collectStatusValues,
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

  // 현대카드는 `2026년 06월 29일` 형식이라 구분자가 년/월/일이다. 이걸 못 읽어
  // 전 행이 skip 되고 거래 0건짜리 리포트가 만들어졌다 (#29).
  it.each([
    ["2026년 06월 29일", "2026-06-29"],
    ["2026년 6월 5일", "2026-06-05"],
    ["2026년 12월 31일", "2026-12-31"],
    ["  2026년 06월 29일  ", "2026-06-29"],
    ["2026년 06월 29일 13:22", "2026-06-29"],
  ])("normalizes the Korean-separator form %s", (raw, expected) => {
    expect(parseTxnDate(raw)).toBe(expected);
  });

  it.each([
    ["2026-07-31", "2026-07-31"],
    ["2026.06.13", "2026-06-13"],
    ["2026/06/13", "2026-06-13"],
    ["20260629", "2026-06-29"],
    ["2026-07-31 12:34:56", "2026-07-31"],
    ["  2026.06.13  ", "2026-06-13"],
  ])("keeps the existing form %s working", (raw, expected) => {
    expect(parseTxnDate(raw)).toBe(expected);
  });

  it("zero-pads a single digit month and day", () => {
    expect(parseTxnDate("2026년 4월 7일")).toBe("2026-04-07");
  });

  // 한 자리 월·일을 허용하면 구분자 없는 6자리 숫자가 날짜로 읽힐 위험이 생긴다.
  // 구분자가 없을 때는 8자리만 날짜다.
  it.each(["202612", "2026", "20261", "2026061", "202606291"])(
    "rejects the separator-less %s that is not eight digits",
    (raw) => {
      expect(parseTxnDate(raw)).toBeNull();
    },
  );

  it("returns null for an invalid date", () => {
    expect(parseTxnDate("2025-02-30")).toBeNull();
    expect(parseTxnDate("날짜 없음")).toBeNull();
    expect(parseTxnDate("2026년 13월 01일")).toBeNull();
    expect(parseTxnDate("2026년 02월 30일")).toBeNull();
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
      excluded: 0,
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

describe("normalizeRows 취소 정책", () => {
  const statusMap: ColumnMap = {
    date: 0,
    merchant: 1,
    amount: 2,
    txnType: 3,
    txnTypeRules: { 정상: "normal", 승인취소: "void", 취소전표매입: "reversal" },
  };

  function rowsWith(...statuses: string[]) {
    return [
      ["날짜", "가맹점", "금액", "상태"],
      ...statuses.map((status, index) => [
        "2026-03-14",
        `가맹점${index}`,
        "10000",
        status,
      ]),
    ];
  }

  it("drops void rows and counts them apart from skipped", () => {
    const result = normalizeRows(rowsWith("정상", "승인취소", "정상"), statusMap, 0);

    expect(result.txns).toHaveLength(2);
    expect(result.excluded).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.txns.map(({ rowIndex }) => rowIndex)).toEqual([1, 3]);
  });

  it("negates reversal amounts", () => {
    const result = normalizeRows(rowsWith("정상", "취소전표매입"), statusMap, 0);

    expect(result.txns.map(({ amount }) => amount)).toEqual([10_000, -10_000]);
    expect(result.excluded).toBe(0);
  });

  it("keeps unknown status values positive", () => {
    const result = normalizeRows(rowsWith("해외매입", ""), statusMap, 0);

    expect(result.txns.map(({ amount }) => amount)).toEqual([10_000, 10_000]);
    expect(result.excluded).toBe(0);
  });

  it("treats every row as normal when no rules are cached yet", () => {
    const noRules: ColumnMap = { date: 0, merchant: 1, amount: 2, txnType: 3 };
    const result = normalizeRows(rowsWith("정상", "승인취소", "취소전표매입"), noRules, 0);

    expect(result.txns.map(({ amount }) => amount)).toEqual([10_000, 10_000, 10_000]);
    expect(result.excluded).toBe(0);
  });

  it("ignores the status column entirely when txnType is null", () => {
    const withoutColumn: ColumnMap = { ...statusMap, txnType: null };
    const result = normalizeRows(rowsWith("승인취소", "취소전표매입"), withoutColumn, 0);

    expect(result.txns.map(({ amount }) => amount)).toEqual([10_000, 10_000]);
    expect(result.excluded).toBe(0);
  });

  it("counts an unreadable void row as skipped, not excluded", () => {
    const rows = [
      ["날짜", "가맹점", "금액", "상태"],
      ["날짜 아님", "가맹점", "10000", "승인취소"],
    ];

    expect(normalizeRows(rows, statusMap, 0)).toEqual({
      txns: [],
      skipped: 1,
      excluded: 0,
    });
  });
});

describe("collectStatusValues", () => {
  const map: ColumnMap = { date: 0, merchant: 1, amount: 2, txnType: 3 };
  const rows = [
    ["날짜", "가맹점", "금액", "상태"],
    ["2026-03-14", "가맹점1", "1000", "전표매입"],
    ["2026-03-15", "가맹점2", "2000", "승인취소"],
    ["2026-03-16", "가맹점3", "3000", "전표매입"],
  ];

  it("returns each distinct status value once", () => {
    expect(collectStatusValues(rows, map, 0).sort()).toEqual(["승인취소", "전표매입"]);
  });

  it("returns nothing when the format has no status column", () => {
    expect(collectStatusValues(rows, { ...map, txnType: null }, 0)).toEqual([]);
  });

  it("ignores blank status cells", () => {
    const withBlank = [...rows, ["2026-03-17", "가맹점4", "4000", "   "]];
    expect(collectStatusValues(withBlank, map, 0)).not.toContain("");
  });

  it("gives up when the column looks like free text instead of a status", () => {
    const many = [
      ["날짜", "가맹점", "금액", "상태"],
      ...Array.from({ length: MAX_STATUS_VALUES + 1 }, (_, index) => [
        "2026-03-14",
        `가맹점${index}`,
        "1000",
        `값${index}`,
      ]),
    ];

    expect(collectStatusValues(many, map, 0)).toEqual([]);
  });
});

/**
 * 국민카드4.csv (309 거래행) 실측 회귀. 건수·상태별 합계·판정별 합계는 실제 파일과
 * 업로드 6d500cb2 의 DB 판정에서 그대로 가져왔고, 개별 금액만 합성이다 — 사용자의
 * 실제 거래 금액과 가맹점명을 레포에 남기지 않기 위해서다.
 */
describe("국민카드4.csv 실측 회귀", () => {
  const map: ColumnMap = {
    date: 0,
    merchant: 4,
    amount: 5,
    txnType: 11,
    txnTypeRules: {
      전표매입: "normal",
      승인취소: "void",
      취소전표매입: "reversal",
    },
  };

  type PlannedRow = {
    amount: number;
    status: string;
    verdict: ClassifiedTxn["verdict"];
  };

  function group(
    count: number,
    unit: number,
    total: number,
    status: string,
    verdict: ClassifiedTxn["verdict"],
  ): PlannedRow[] {
    const head = Array.from({ length: count - 1 }, () => unit);
    const remainder = total - head.reduce((sum, value) => sum + value, 0);
    return [...head, remainder].map((amount) => ({ amount, status, verdict }));
  }

  // 전표매입 290건 11,993,914원 · 승인취소 16건 2,009,201원 · 취소전표매입 3건 491,140원
  const plan: PlannedRow[] = [
    ...group(215, 20_000, 5_691_280, "전표매입", "expense"),
    ...group(22, 100_000, 3_650_610, "전표매입", "personal"),
    ...group(53, 10_000, 2_652_024, "전표매입", "uncertain"),
    ...group(16, 100_000, 2_009_201, "승인취소", "expense"),
    { amount: 0, status: "취소전표매입", verdict: "expense" },
    { amount: 92_150, status: "취소전표매입", verdict: "expense" },
    { amount: 398_990, status: "취소전표매입", verdict: "uncertain" },
  ];

  const rows = [
    ["이용일", "", "", "", "이용하신곳", "국내이용금액", "", "", "", "", "", "상태"],
    ...plan.map((row, index) => {
      const cells = Array.from({ length: 12 }, () => "");
      cells[0] = "2026-07-31";
      cells[4] = `가맹점${index}`;
      cells[5] = row.amount.toLocaleString("en-US");
      cells[11] = row.status;
      return cells;
    }),
  ];

  const result = normalizeRows(rows, map, 0);

  it("reads 309 transaction rows", () => {
    expect(plan).toHaveLength(309);
  });

  it("excludes the 16 승인취소 rows", () => {
    expect(result.excluded).toBe(16);
  });

  it("negates the 3 취소전표매입 rows", () => {
    const negatives = result.txns.filter(({ amount }) => amount < 0);
    expect(negatives.map(({ amount }) => amount)).toEqual([-92_150, -398_990]);
    expect(result.txns.filter(({ rowIndex }) => plan[rowIndex - 1]!.status === "취소전표매입"))
      .toHaveLength(3);
  });

  it("keeps 293 transactions", () => {
    expect(result.txns).toHaveLength(293);
    expect(result.skipped).toBe(0);
  });

  it("nets the statement down to 11,502,774원", () => {
    expect(result.txns.reduce((sum, { amount }) => sum + amount, 0)).toBe(11_502_774);
  });

  it("estimates 369,542원 of savings", () => {
    const classified: ClassifiedTxn[] = result.txns.map((txn) => {
      const planned = plan[txn.rowIndex - 1]!;
      return {
        ...txn,
        verdict: planned.verdict,
        accountCode: planned.verdict === "expense" ? "supplies" : null,
      };
    });
    const summary = aggregate(classified, result.excluded);

    expect(summary.txnCount).toBe(293);
    expect(summary.expenseTotal).toBe(5_599_130);
    expect(summary.personalTotal).toBe(3_650_610);
    expect(summary.uncertainTotal).toBe(2_253_034);
    expect(summary.uncertainCount).toBe(54);
    expect(summary.estimatedSaving).toBe(369_542);
  });

  it("reports the excluded rows as an insight", () => {
    const classified: ClassifiedTxn[] = result.txns.map((txn) => ({
      ...txn,
      verdict: "expense",
      accountCode: "supplies",
    }));
    const voided = aggregate(classified, result.excluded).insights.find(
      ({ id }) => id === "voided",
    );

    expect(voided?.title).toContain("16");
  });
});

// 현대카드 양식의 구조만 재현한 합성 픽스처다. 실제 명세서의 가맹점명·금액은
// 담지 않는다 (ADR-005). 재현하는 것은 10개 컬럼 배치와 `YYYY년 MM월 DD일`
// 날짜 표기, 그리고 금액으로 읽히는 컬럼이 여섯 개라는 점뿐이다.
const koreanDateRows = [
  ["이용일", "이용카드", "이용가맹점", "이용금액", "할부/회차", "적립/할인율(%)", "예상적립/할인", "결제원금", "결제후잔액", "수수료(이자)"],
  ["2026년 06월 29일", "합성카드", "합성가맹점A", "10,000", "", "0.7%", "-70", "9,930", "0", "0"],
  ["2026년 06월 01일", "합성카드", "합성가맹점B", "20,000", "", "0.70%", "-140", "19,860", "0", "0"],
  ["2026년 06월 05일", "합성카드", "합성가맹점C", "30,000", "", "0.70%", "-210", "29,790", "0", "0"],
  ["2026년 5월 1일", "합성카드", "합성가맹점D", "40,000", "", "0.70%", "-280", "39,720", "0", "0"],
  ["2026년 4월 14일", "합성카드", "합성가맹점E", "0", "", "0%", "0", "0", "0", "5,000"],
];
const koreanDateMap: ColumnMap = { date: 0, merchant: 2, amount: 3, txnType: null };

describe("normalizeRows on a Korean-date ten-column format", () => {
  it("parses every one of the five date rows", () => {
    const result = normalizeRows(koreanDateRows, koreanDateMap, 0);

    expect(result.txns).toHaveLength(5);
    expect(result.skipped).toBe(0);
    expect(result.txns.map(({ txnDate }) => txnDate)).toEqual([
      "2026-06-29",
      "2026-06-01",
      "2026-06-05",
      "2026-05-01",
      "2026-04-14",
    ]);
  });

  it("takes the merchant from the 이용가맹점 column", () => {
    expect(
      normalizeRows(koreanDateRows, koreanDateMap, 0).txns.map(({ merchant }) => merchant),
    ).toEqual([
      "합성가맹점A",
      "합성가맹점B",
      "합성가맹점C",
      "합성가맹점D",
      "합성가맹점E",
    ]);
  });

  it("takes the amount from the 이용금액 column, not the discount column", () => {
    expect(
      normalizeRows(koreanDateRows, koreanDateMap, 0).txns.map(({ amount }) => amount),
    ).toEqual([10_000, 20_000, 30_000, 40_000, 0]);
  });

  // 이 컬럼이 amount 로 뽑히면 전 거래가 음수가 된다. mapColumns 가 그걸 거르는
  // 근거가 되는 성질을 여기서 고정해 둔다.
  it("has a discount column whose every value is at or below zero", () => {
    const discounts = koreanDateRows
      .slice(1)
      .map((row) => parseAmount(row[6]!))
      .filter((value): value is number => value !== null);

    expect(discounts).toHaveLength(5);
    expect(discounts.every((value) => value <= 0)).toBe(true);
  });
});
