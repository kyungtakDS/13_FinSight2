import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaudeCallError } from "@/services/claude/client";
import { RowLimitExceeded } from "@/lib/csv/normalize";

const mocks = vi.hoisted(() => ({
  getUpload: vi.fn(),
  download: vi.fn(),
  update: vi.fn(),
  removeTxns: vi.fn(),
  insertTxns: vi.fn(),
  serviceClient: vi.fn(),
  detectEncoding: vi.fn(),
  decodeCsv: vi.fn(),
  parseRows: vi.fn(),
  normalizeRows: vi.fn(),
  fingerprint: vi.fn(),
  mapColumns: vi.fn(),
  lookup: vi.fn(),
  upsert: vi.fn(),
  key: vi.fn((value: string) => value.toLowerCase()),
  classify: vi.fn(),
  aggregate: vi.fn(),
  period: vi.fn(),
  mappingMaybeSingle: vi.fn(),
  mappingUpsert: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  getUploadForUser: mocks.getUpload,
  downloadOriginalForUser: mocks.download,
  updateUploadForUser: mocks.update,
  deleteTransactionsForUser: mocks.removeTxns,
  insertTransactionsForUser: mocks.insertTxns,
  createServiceClient: mocks.serviceClient,
}));
vi.mock("@/lib/csv/normalize", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csv/normalize")>();
  return {
    ...actual,
    detectEncoding: mocks.detectEncoding,
    decodeCsv: mocks.decodeCsv,
    parseRows: mocks.parseRows,
    normalizeRows: mocks.normalizeRows,
  };
});
vi.mock("@/lib/csv/fingerprint", () => ({
  FINGERPRINT_ROWS: 20,
  headerFingerprint: mocks.fingerprint,
}));
vi.mock("@/services/claude/map-columns", () => ({ mapColumns: mocks.mapColumns }));
vi.mock("@/lib/classify/dictionary", () => ({
  lookupMerchants: mocks.lookup,
  upsertMerchants: mocks.upsert,
  merchantKey: mocks.key,
}));
vi.mock("@/services/claude/classify-merchants", () => ({
  classifyMerchants: mocks.classify,
}));
vi.mock("@/lib/report/aggregate", () => ({
  aggregate: mocks.aggregate,
  txnPeriod: mocks.period,
}));

const upload = {
  id: "upload-1", userId: "user-1", storagePath: "user-1/upload-1.csv",
  filename: "secret.csv", fileHash: "hash", status: "processing", errorCode: null,
  retryCount: 0, periodStart: null, periodEnd: null, rowCount: null, summary: null,
  expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z", finishedAt: null,
} as const;
const rows = [["date", "merchant", "amount"], ["2026-01-02", "UNIQUE_SHOP", "1000"]];
const normalized = [{ rowIndex: 1, txnDate: "2026-01-02", merchant: "UNIQUE_SHOP", amount: 1000 }];
const mapping = { headerRowIndex: 0, columnMap: { date: 0, merchant: 1, amount: 2, txnType: null } };
const summary = { expenseTotal: 1000, personalTotal: 0, uncertainCount: 0, uncertainTotal: 0, estimatedSaving: 66, taxRate: 0.066, accounts: [], insights: [], txnCount: 1 };

function mappingClient(hit: boolean) {
  mocks.mappingMaybeSingle.mockResolvedValue({
    data: hit ? { header_row_index: 0, column_map: mapping.columnMap, encoding: "utf-8" } : null,
    error: null,
  });
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.mappingMaybeSingle, upsert: mocks.mappingUpsert };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  mocks.mappingUpsert.mockResolvedValue({ error: null });
  mocks.serviceClient.mockReturnValue({ from: vi.fn(() => query) });
}

function dictionaryHit() {
  return new Map([["unique_shop", { merchantKey: "unique_shop", accountCode: "supplies", defaultVerdict: "expense", reason: "fixture" }]]);
}

describe("runAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUpload.mockResolvedValue(upload);
    mocks.download.mockResolvedValue(new Uint8Array([1]));
    mocks.detectEncoding.mockReturnValue("utf-8");
    mocks.decodeCsv.mockReturnValue("CARD-9999,UNIQUE_CSV_CONTENT");
    mocks.parseRows.mockReturnValue(rows);
    mocks.fingerprint.mockReturnValue("fingerprint");
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 0 });
    mocks.lookup.mockResolvedValue(dictionaryHit());
    mocks.upsert.mockResolvedValue({ inserted: 0, rejected: 0 });
    mocks.aggregate.mockReturnValue(summary);
    mocks.period.mockReturnValue({ start: "2026-01-02", end: "2026-01-02" });
    mocks.update.mockResolvedValue(undefined);
    mocks.removeTxns.mockResolvedValue(undefined);
    mocks.insertTxns.mockResolvedValue(undefined);
    mappingClient(true);
  });

  it("uses both caches first and makes zero LLM calls on full hits", async () => {
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.mapColumns).not.toHaveBeenCalled();
    expect(mocks.classify).not.toHaveBeenCalled();
  });

  it("calls and globally stores column mapping only after a cache miss", async () => {
    mappingClient(false); mocks.mapColumns.mockResolvedValue(mapping);
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.mapColumns).toHaveBeenCalledWith(rows.slice(0, 20));
    expect(mocks.mappingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      header_fingerprint: "fingerprint", column_map: mapping.columnMap, header_row_index: 0, encoding: "utf-8",
    }), { onConflict: "header_fingerprint" });
    expect(mocks.mappingUpsert.mock.calls[0]![0]).not.toHaveProperty("user_id");
  });

  it("sends only dictionary misses to Claude and stores definite results", async () => {
    const two = [...normalized, { ...normalized[0]!, rowIndex: 2, merchant: "MISSING_SHOP" }];
    mocks.normalizeRows.mockReturnValue({ txns: two, skipped: 0 });
    mocks.lookup.mockResolvedValue(dictionaryHit());
    mocks.classify.mockResolvedValue([{ accountCode: "travel", verdict: "expense", reason: "fixture" }]);
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.classify).toHaveBeenCalledWith(["MISSING_SHOP"]);
    expect(mocks.classify.mock.calls[0]![0]).not.toContain("UNIQUE_SHOP");
    expect(mocks.upsert).toHaveBeenCalledWith([{ merchantKey: "missing_shop", accountCode: "travel", defaultVerdict: "expense", reason: "fixture" }]);
  });

  it("completes uncertain individual transactions instead of failing", async () => {
    mocks.lookup.mockResolvedValue(new Map());
    mocks.classify.mockResolvedValue([{ accountCode: null, verdict: "uncertain", reason: "unknown" }]);
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.insertTxns).toHaveBeenCalledWith("user-1", "upload-1", [expect.objectContaining({ verdict: "uncertain", accountCode: null, rowIndex: 1 })]);
    expect(mocks.update).toHaveBeenLastCalledWith("user-1", "upload-1", expect.objectContaining({ status: "completed" }));
  });

  it.each([
    [new Error("storage"), "parse_failed", "download"],
    [new RowLimitExceeded(), "too_large", "normalize"],
    [new ClaudeCallError("schema"), "parse_failed", "mapping"],
    [new ClaudeCallError("refusal"), "analysis_failed", "classify"],
    [new ClaudeCallError("max_tokens"), "analysis_failed", "classify"],
    [new ClaudeCallError("context_exceeded"), "analysis_failed", "classify"],
    [new ClaudeCallError("upstream"), "upstream", "classify"],
  ])("maps pipeline failure %# without throwing", async (error, code, stage) => {
    if (stage === "download") mocks.download.mockRejectedValue(error);
    if (stage === "normalize") mocks.normalizeRows.mockImplementation(() => { throw error; });
    if (stage === "mapping") { mappingClient(false); mocks.mapColumns.mockRejectedValue(error); }
    if (stage === "classify") { mocks.lookup.mockResolvedValue(new Map()); mocks.classify.mockRejectedValue(error); }
    const { runAnalysis } = await import("./run-analysis");
    await expect(runAnalysis("user-1", "upload-1")).resolves.toBeUndefined();
    expect(mocks.update).toHaveBeenLastCalledWith("user-1", "upload-1", expect.objectContaining({ status: "failed", errorCode: code, finishedAt: expect.any(String) }));
  });

  it("never throws even when every dependency and failure update reject", async () => {
    mocks.getUpload.mockRejectedValue(new Error("db")); mocks.update.mockRejectedValue(new Error("db2"));
    const { runAnalysis } = await import("./run-analysis");
    await expect(runAnalysis("user-1", "upload-1")).resolves.toBeUndefined();
  });

  it("replaces transactions, aggregates, and completes with period metadata", async () => {
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.removeTxns).toHaveBeenCalledWith("user-1", "upload-1");
    expect(mocks.removeTxns.mock.invocationCallOrder[0]).toBeLessThan(mocks.insertTxns.mock.invocationCallOrder[0]!);
    expect(mocks.insertTxns).toHaveBeenCalledWith("user-1", "upload-1", [expect.objectContaining({ rowIndex: 1 })]);
    expect(mocks.aggregate).toHaveBeenCalled();
    expect(mocks.update).toHaveBeenLastCalledWith("user-1", "upload-1", expect.objectContaining({ status: "completed", summary, periodStart: "2026-01-02", periodEnd: "2026-01-02", rowCount: 1, finishedAt: expect.any(String) }));
  });

  it("does nothing for an already completed upload", async () => {
    mocks.getUpload.mockResolvedValue({ ...upload, status: "completed" });
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.download).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });

  it("never logs merchant, CSV, card number, filename, amount, or raw error", async () => {
    const spies = ["log", "error", "warn", "info"].map((method) => vi.spyOn(console, method as "error").mockImplementation(() => undefined));
    mocks.lookup.mockResolvedValue(new Map()); mocks.classify.mockRejectedValue(new ClaudeCallError("refusal"));
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    const logged = spies.flatMap((spy) => spy.mock.calls).flat().map(String).join(" ");
    expect(logged).not.toMatch(/UNIQUE_SHOP|UNIQUE_CSV_CONTENT|CARD-9999|secret\.csv|1000|Claude refused/u);
    expect(logged).toContain("analysis_failed"); expect(logged).toContain("refusal"); expect(logged).toContain("rowCount");
    spies.forEach((spy) => spy.mockRestore());
  });
});
