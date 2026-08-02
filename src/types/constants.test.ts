import { describe, expect, it } from "vitest";

import {
  ACCOUNT_CODES,
  ERROR_CODES,
  VERDICTS,
  isAccountCode,
  isErrorCode,
  isVerdict,
} from "@/types";

describe("shared fixed vocabularies", () => {
  it("defines exactly the seven public error codes", () => {
    expect(ERROR_CODES).toHaveLength(7);
    expect(new Set(ERROR_CODES)).toEqual(
      new Set([
        "parse_failed",
        "too_large",
        "duplicate_file",
        "analysis_failed",
        "upstream",
        "expired",
        "payment_required",
      ]),
    );
  });

  it("defines the three verdicts in their canonical order", () => {
    expect(VERDICTS).toEqual(["expense", "personal", "uncertain"]);
  });

  it("defines 18 unique account codes and labels", () => {
    expect(ACCOUNT_CODES).toHaveLength(18);
    expect(new Set(ACCOUNT_CODES.map(({ code }) => code))).toHaveLength(18);
    expect(new Set(ACCOUNT_CODES.map(({ label }) => label))).toHaveLength(18);
  });

  it("uses stable lowercase ASCII account codes", () => {
    for (const { code } of ACCOUNT_CODES) {
      expect(code).toMatch(/^[a-z]+$/);
    }
  });

  it("guards values against each fixed vocabulary", () => {
    expect(isErrorCode("parse_failed")).toBe(true);
    expect(isErrorCode("database_failed")).toBe(false);
    expect(isVerdict("expense")).toBe(true);
    expect(isVerdict("maybe")).toBe(false);
    expect(isAccountCode("welfare")).toBe(true);
    expect(isAccountCode("miscellaneous")).toBe(false);
  });

  it("freezes every fixed-vocabulary array at runtime", () => {
    expect(Object.isFrozen(ERROR_CODES)).toBe(true);
    expect(Object.isFrozen(VERDICTS)).toBe(true);
    expect(Object.isFrozen(ACCOUNT_CODES)).toBe(true);

    expect(() => {
      (ERROR_CODES as unknown as string[]).push("unexpected");
    }).toThrow();
    expect(() => {
      (VERDICTS as unknown as string[]).push("unexpected");
    }).toThrow();
    expect(() => {
      (ACCOUNT_CODES as unknown as Array<{ code: string; label: string }>).push({
        code: "unexpected",
        label: "예상하지 않은 항목",
      });
    }).toThrow();
  });
});
