import { describe, expect, it, vi } from "vitest";

import { ACCOUNT_CODES, accountLabel } from "@/types/account-codes";
import type { ClassifiedTxn } from "@/types/transaction";

import { aggregate, ESTIMATED_TAX_RATE, txnPeriod } from "./aggregate";

function txn(
  rowIndex: number,
  amount: number,
  verdict: ClassifiedTxn["verdict"] = "expense",
  accountCode: ClassifiedTxn["accountCode"] = "supplies",
  txnDate = "2026-05-01",
): ClassifiedTxn {
  return {
    rowIndex,
    txnDate,
    merchant: `merchant-${rowIndex}`,
    amount,
    accountCode,
    verdict,
  };
}

describe("aggregate", () => {
  it("sums expense transactions exactly", () => {
    expect(aggregate([txn(1, 100), txn(2, 200), txn(3, 300)]).expenseTotal).toBe(600);
  });

  it("nets cancellation amounts within an account", () => {
    const summary = aggregate([txn(1, 10_000), txn(2, -10_000)]);
    expect(summary.accounts[0]?.total).toBe(0);
  });

  it("includes cancellation rows in counts", () => {
    expect(aggregate([txn(1, 10_000), txn(2, -10_000)]).accounts[0]?.count).toBe(2);
  });

  it("retains accounts whose net total is negative", () => {
    expect(aggregate([txn(1, 5_000), txn(2, -10_000)]).accounts[0]?.total).toBe(-5_000);
  });

  it("excludes uncertain transactions from estimatedSaving", () => {
    expect(aggregate([txn(1, 10_000, "uncertain", null)]).estimatedSaving).toBe(0);
  });

  it("excludes uncertain transactions from expenseTotal", () => {
    expect(aggregate([txn(1, 10_000, "uncertain", null)]).expenseTotal).toBe(0);
  });

  it("counts uncertain transactions", () => {
    expect(aggregate([txn(1, 10, "uncertain", null), txn(2, 20, "uncertain", null)]).uncertainCount).toBe(2);
  });

  it("sums uncertain amounts separately", () => {
    expect(aggregate([txn(1, 100, "uncertain", null), txn(2, -30, "uncertain", null)]).uncertainTotal).toBe(70);
  });

  it("does not put uncertain transactions in account breakdowns", () => {
    expect(aggregate([txn(1, 100, "uncertain", "supplies")]).accounts).toEqual([]);
  });

  it("handles an all-uncertain input", () => {
    expect(aggregate([txn(1, 100, "uncertain", null)]).estimatedSaving).toBe(0);
  });

  it("uses floor(expenseTotal * ESTIMATED_TAX_RATE)", () => {
    const summary = aggregate([txn(1, 10_000)]);
    expect(summary.estimatedSaving).toBe(Math.floor(summary.expenseTotal * ESTIMATED_TAX_RATE));
  });

  it("floors instead of rounding the estimate", () => {
    expect(aggregate([txn(1, 99)]).estimatedSaving).toBe(6);
  });

  it("clamps estimatedSaving to zero for a negative expense total", () => {
    expect(aggregate([txn(1, -10_000)]).estimatedSaving).toBe(0);
  });

  it("includes taxRate in the summary", () => {
    expect(aggregate([]).taxRate).toBe(ESTIMATED_TAX_RATE);
  });

  it("sorts accounts by descending total", () => {
    const summary = aggregate([
      txn(1, 100, "expense", "supplies"),
      txn(2, 300, "expense", "books"),
    ]);
    expect(summary.accounts.map(({ code }) => code)).toEqual(["books", "supplies"]);
  });

  it("makes positive account ratios sum to one", () => {
    const totalRatio = aggregate([
      txn(1, 100, "expense", "supplies"),
      txn(2, 300, "expense", "books"),
    ]).accounts.reduce((sum, account) => sum + account.ratio, 0);
    expect(totalRatio).toBeCloseTo(1);
  });

  it("gets account labels from ACCOUNT_CODES", () => {
    const account = aggregate([txn(1, 100, "expense", ACCOUNT_CODES[0].code)]).accounts[0]!;
    expect(account.label).toBe(accountLabel(account.code));
  });

  it("keeps invalid null-account expenses visible instead of coercing them to etc", () => {
    const summary = aggregate([txn(1, 100, "expense", null)]);
    expect(summary.accounts).toEqual([]);
    expect(summary.expenseTotal).toBe(0);
    expect(summary.uncertainCount).toBe(1);
    expect(summary.uncertainTotal).toBe(100);
  });

  it("creates deterministic insights", () => {
    const input = [txn(1, 100), txn(2, 20, "uncertain", null)];
    expect(aggregate(input).insights).toEqual(aggregate(input).insights);
  });

  it("gives every insight a stable id", () => {
    const ids = aggregate([txn(1, 100), txn(2, -10)]).insights.map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("always includes an uncertain insight in the top three", () => {
    const insights = aggregate([txn(1, 100), txn(2, 20, "uncertain", null)]).insights;
    expect(insights.slice(0, 3).some(({ id }) => id === "uncertain")).toBe(true);
  });

  it("includes a cancellation offset insight", () => {
    const insights = aggregate([txn(1, 100), txn(2, -30)]).insights;
    expect(insights.some(({ id }) => id === "cancellations")).toBe(true);
  });

  it("reports voided rows that never reached the transaction list", () => {
    const voided = aggregate([txn(1, 100)], 16).insights.find(({ id }) => id === "voided");
    expect(voided?.title).toContain("16");
  });

  it("omits the voided insight when nothing was excluded", () => {
    expect(aggregate([txn(1, 100)]).insights.some(({ id }) => id === "voided")).toBe(false);
    expect(aggregate([txn(1, 100)], 0).insights.some(({ id }) => id === "voided")).toBe(false);
  });

  it("keeps voided rows out of every total", () => {
    const summary = aggregate([txn(1, 100)], 16);
    expect(summary).toMatchObject({ expenseTotal: 100, txnCount: 1, estimatedSaving: 6 });
  });

  it("puts only counts in the voided insight", () => {
    const voided = aggregate([txn(1, 100)], 2).insights.find(({ id }) => id === "voided")!;
    expect(`${voided.title} ${voided.body}`).not.toMatch(/merchant-|100/);
  });

  it("returns no insights for no data", () => {
    expect(aggregate([]).insights).toEqual([]);
  });

  it("does not use directive tax-advice wording", () => {
    const text = JSON.stringify(aggregate([txn(1, 100), txn(2, 20, "uncertain", null)]).insights);
    expect(text).not.toMatch(/경비 처리하세요|환급받으세요|신고하세요/);
  });

  it("returns zero totals for an empty input", () => {
    expect(aggregate([])).toMatchObject({
      expenseTotal: 0,
      personalTotal: 0,
      uncertainCount: 0,
      uncertainTotal: 0,
      estimatedSaving: 0,
      txnCount: 0,
    });
  });

  it("returns a null period for an empty input", () => {
    expect(txnPeriod([])).toEqual({ start: null, end: null });
  });

  it("does not mutate the input array or its transactions", () => {
    const input = [txn(1, 100, "expense", "supplies"), txn(2, 300, "expense", "books")];
    const snapshot = structuredClone(input);
    aggregate(input);
    expect(input).toEqual(snapshot);
  });

  it("does not call console methods", () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
    ];
    aggregate([txn(1, 100)]);
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("txnPeriod", () => {
  it("uses the minimum and maximum transaction dates", () => {
    expect(txnPeriod([txn(1, 1, "expense", "supplies", "2026-05-31"), txn(2, 1, "expense", "supplies", "2026-05-01")])).toEqual({
      start: "2026-05-01",
      end: "2026-05-31",
    });
  });
});
