import { describe, expect, it } from "vitest";

import {
  FINGERPRINT_ROWS,
  fileHash,
  headerFingerprint,
} from "./fingerprint";

const shinhanMarch = [
  ["신한카드 이용내역"],
  ["조회기간", "2025.03.01 ~ 2025.03.31"],
  ["이용일자", "가맹점명", "이용금액"],
  ["2025.03.14", "삼월상점", "12,300"],
  ["2025.03.20", "봄카페", "8,900"],
];

const shinhanApril = [
  ["신한카드 이용내역"],
  ["조회기간", "2025.04.01 ~ 2025.04.30"],
  ["이용일자", "가맹점명", "이용금액"],
  ["2025.04.02", "사월문구", "31,000"],
  ["2025.04.27", "푸른식당", "4,500"],
];

describe("fileHash", () => {
  it("returns the same hash for the same bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);

    expect(fileHash(bytes)).toBe(fileHash(bytes));
  });

  it("changes when one byte changes", () => {
    expect(fileHash(new Uint8Array([1, 2, 3]))).not.toBe(
      fileHash(new Uint8Array([1, 2, 4])),
    );
  });

  it("returns a lowercase 64-character sha256 hex digest", () => {
    expect(fileHash(new Uint8Array([1, 2, 3]))).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("hashes an empty input without throwing", () => {
    expect(() => fileHash(new Uint8Array())).not.toThrow();
    expect(fileHash(new Uint8Array())).toHaveLength(64);
  });

  it("hashes the 2MB upload limit", () => {
    const bytes = new Uint8Array(2 * 1024 * 1024);
    const startedAt = performance.now();

    expect(fileHash(bytes)).toHaveLength(64);
    expect(performance.now() - startedAt).toBeLessThan(1_000);
  });
});

describe("headerFingerprint", () => {
  it("matches for different monthly statements with the same format", () => {
    expect(headerFingerprint(shinhanMarch)).toBe(
      headerFingerprint(shinhanApril),
    );
  });

  it("differs for another card format", () => {
    const anotherCard = [
      ["현대카드"],
      ["카드 이용 명세"],
      ["작성일", "2025-04-30"],
      ["승인일", "결제금액", "사용처", "구분"],
      ["2025-04-02", "31,000", "사월문구", "일시불"],
    ];

    expect(headerFingerprint(shinhanMarch)).not.toBe(
      headerFingerprint(anotherCard),
    );
  });

  it("differs when columns with the same names are reordered", () => {
    const first = [["이용일자", "가맹점명", "이용금액"]];
    const reordered = [["이용금액", "가맹점명", "이용일자"]];

    expect(headerFingerprint(first)).not.toBe(headerFingerprint(reordered));
  });

  it("differs when a row has a different cell count", () => {
    expect(headerFingerprint([["이용일자", "가맹점명"]])).not.toBe(
      headerFingerprint([["이용일자", "가맹점명", "이용금액"]]),
    );
  });

  it("ignores rows after the first 20", () => {
    const firstTwenty = Array.from(
      { length: FINGERPRINT_ROWS },
      (_, index) => [`메타 ${index}`],
    );

    expect(headerFingerprint([...firstTwenty, ["추가 행"]])).toBe(
      headerFingerprint([...firstTwenty, ["완전히 다른 행"]]),
    );
  });

  it("accepts files with fewer than 20 rows", () => {
    expect(() => headerFingerprint([["이용일자"]])).not.toThrow();
    expect(() => headerFingerprint([])).not.toThrow();
  });

  it("does not expose amount digits through the fingerprint", () => {
    const lowAmount = [["2025.03.14", "같은상점", "1,000"]];
    const highAmount = [["2025.03.14", "같은상점", "999,999"]];

    expect(headerFingerprint(lowAmount)).toBe(headerFingerprint(highAmount));
  });

  it("excludes merchant text from data rows", () => {
    const firstMerchant = [
      ["이용일자", "가맹점명", "이용금액"],
      ["2025.03.14", "민감한상호명", "12,300"],
    ];
    const secondMerchant = [
      ["이용일자", "가맹점명", "이용금액"],
      ["2025.03.14", "전혀다른상호", "12,300"],
    ];

    expect(headerFingerprint(firstMerchant)).toBe(
      headerFingerprint(secondMerchant),
    );
  });

  it("is deterministic", () => {
    expect(headerFingerprint(shinhanMarch)).toBe(
      headerFingerprint(shinhanMarch),
    );
  });
});
