import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { UploadSummary } from "@/types/report";
import type { ClassifiedTxn } from "@/types/transaction";

import { gateReport, viewScope } from "./gate";

const insights = Array.from({ length: 5 }, (_, index) => ({
  id: `insight-${index + 1}`,
  title: `insight title ${index + 1}`,
  body: `insight body ${index + 1}`,
}));

const summary: UploadSummary = {
  expenseTotal: 123_456,
  personalTotal: 78_901,
  uncertainCount: 2,
  uncertainTotal: 4_321,
  estimatedSaving: 8_148,
  taxRate: 0.066,
  accounts: [],
  insights,
  txnCount: 2,
};

const txns: ClassifiedTxn[] = [
  {
    rowIndex: 1,
    txnDate: "2026-05-01",
    merchant: "스타벅스",
    amount: 91_827_364,
    accountCode: "meeting",
    verdict: "expense",
  },
  {
    rowIndex: 2,
    txnDate: "2026-05-02",
    merchant: "고유가맹점",
    amount: 56_473_829,
    accountCode: null,
    verdict: "personal",
  },
];

describe("viewScope", () => {
  it("locks transactions, limits insights, and disables export for free", () => {
    expect(viewScope("free")).toEqual({
      canViewTransactions: false,
      insightLimit: 3,
      canExport: false,
    });
  });

  it("unlocks all report capabilities for pro", () => {
    expect(viewScope("pro")).toEqual({
      canViewTransactions: true,
      insightLimit: null,
      canExport: true,
    });
  });

  it("fails closed for an unknown plan", () => {
    expect(viewScope("enterprise" as never)).toEqual(viewScope("free"));
  });
});

describe("gateReport for free", () => {
  it("returns an empty transactions array", () => {
    expect(gateReport("free", summary, txns).transactions).toEqual([]);
  });

  it("does not serialize merchant names", () => {
    const json = JSON.stringify(gateReport("free", summary, txns));
    expect(json).not.toContain("스타벅스");
    expect(json).not.toContain("고유가맹점");
  });

  it("does not serialize individual transaction amounts", () => {
    const json = JSON.stringify(gateReport("free", summary, txns));
    expect(json).not.toContain("91827364");
    expect(json).not.toContain("56473829");
  });

  it("returns exactly three insights when at least three exist", () => {
    expect(gateReport("free", summary, txns).summary.insights).toHaveLength(3);
  });

  it("preserves the first-three insight order", () => {
    expect(gateReport("free", summary, txns).summary.insights).toEqual(insights.slice(0, 3));
  });

  it("returns every available insight when fewer than three exist", () => {
    const shortSummary = { ...summary, insights: insights.slice(0, 2) };
    expect(gateReport("free", shortSummary, txns).summary.insights).toEqual(shortSummary.insights);
  });

  it("reports the number of locked transactions", () => {
    expect(gateReport("free", summary, txns).lockedTxnCount).toBe(txns.length);
  });

  it("disables export", () => {
    expect(gateReport("free", summary, txns).canExport).toBe(false);
  });

  it("preserves free summary totals, saving, and uncertain count", () => {
    expect(gateReport("free", summary, txns).summary).toMatchObject({
      expenseTotal: summary.expenseTotal,
      personalTotal: summary.personalTotal,
      estimatedSaving: summary.estimatedSaving,
      uncertainCount: summary.uncertainCount,
    });
  });
});

describe("gateReport for pro", () => {
  it("returns every transaction", () => {
    expect(gateReport("pro", summary, txns).transactions).toEqual(txns);
  });

  it("returns every insight", () => {
    expect(gateReport("pro", summary, txns).summary.insights).toEqual(insights);
  });

  it("enables export and reports no locked transactions", () => {
    expect(gateReport("pro", summary, txns)).toMatchObject({
      canExport: true,
      lockedTxnCount: 0,
    });
  });
});

describe("purity", () => {
  it("does not mutate summary or transactions", () => {
    const summaryInput = structuredClone(summary);
    const txnsInput = structuredClone(txns);
    const summarySnapshot = structuredClone(summaryInput);
    const txnsSnapshot = structuredClone(txnsInput);

    gateReport("free", summaryInput, txnsInput);
    gateReport("pro", summaryInput, txnsInput);

    expect(summaryInput).toEqual(summarySnapshot);
    expect(txnsInput).toEqual(txnsSnapshot);
  });

  it("contains no database, network, or environment access", () => {
    const source = readFileSync(resolve("src/lib/gate.ts"), "utf8");
    expect(source).not.toMatch(/process\.env|supabase|getProfilePlan|fetch\s*\(/);
  });
});
