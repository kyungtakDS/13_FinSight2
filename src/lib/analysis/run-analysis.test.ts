import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClaudeCallError } from "@/services/claude/client";
import {
  CLASSIFY_BATCH_SIZE,
  ClassifyBatchError,
} from "@/services/claude/classify-merchants";
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
  mapStatus: vi.fn(),
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
vi.mock("@/services/claude/map-status", () => ({ mapStatusValues: mocks.mapStatus }));
vi.mock("@/lib/classify/dictionary", () => ({
  lookupMerchants: mocks.lookup,
  upsertMerchants: mocks.upsert,
  merchantKey: mocks.key,
}));
// ClassifyBatchError 는 instanceof 로 판별되므로 원본 클래스를 그대로 남긴다.
vi.mock("@/services/claude/classify-merchants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/claude/classify-merchants")>()),
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

function mappingClient(hit: boolean, columnMap: Record<string, unknown> = mapping.columnMap) {
  mocks.mappingMaybeSingle.mockResolvedValue({
    data: hit ? { header_row_index: 0, column_map: columnMap, encoding: "utf-8" } : null,
    error: null,
  });
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.mappingMaybeSingle, upsert: mocks.mappingUpsert };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  mocks.mappingUpsert.mockResolvedValue({ error: null });
  mocks.serviceClient.mockReturnValue({ from: vi.fn(() => query) });
}

type Verdictish = { accountCode: string | null; verdict: string; reason: string | null };
type BatchOptions = {
  onBatchComplete?: (batch: {
    names: string[];
    verdicts: Verdictish[];
  }) => Promise<void> | void;
};

/**
 * 실제 classifyMerchants 처럼 배치 완료를 알린 뒤 판정을 돌려준다. 사전 저장은
 * 그 콜백에서 일어나므로, 알리지 않는 mock 은 저장 경로를 아예 재현하지 못한다.
 */
function classifyingAs(...verdicts: Verdictish[]) {
  return async (names: string[], options?: BatchOptions) => {
    const produced = names.map((_, index) => verdicts[index] ?? verdicts[0]!);
    await options?.onBatchComplete?.({ names, verdicts: produced });
    return produced;
  };
}

function dictionaryWrites(): Verdictish[] {
  return (mocks.upsert.mock.calls as [Verdictish[]][]).flatMap(([entries]) => entries);
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
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 0, excluded: 0 });
    mocks.mapStatus.mockResolvedValue({ rules: {}, unresolved: 0, failureKind: null });
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
    mocks.normalizeRows.mockReturnValue({ txns: two, skipped: 0, excluded: 0 });
    mocks.lookup.mockResolvedValue(dictionaryHit());
    mocks.classify.mockImplementation(classifyingAs({ accountCode: "travel", verdict: "expense", reason: "fixture" }));
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.classify).toHaveBeenCalledWith(["MISSING_SHOP"], expect.any(Object));
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

  // personal 은 이번 분석 거래에만 반영하고 전역 딕셔너리에는 캐시하지 않는다.
  // 딕셔너리는 사용자 간 공유라 한 사람의 개인 지출 판정이 남에게 번지면 안 된다.
  it("applies a personal verdict to the analysed transactions", async () => {
    mocks.lookup.mockResolvedValue(new Map());
    mocks.classify.mockResolvedValue([{ accountCode: null, verdict: "personal", reason: "개인 지출" }]);
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(mocks.insertTxns).toHaveBeenCalledWith("user-1", "upload-1", [expect.objectContaining({ verdict: "personal", accountCode: null, rowIndex: 1 })]);
  });

  it("never caches a personal verdict in the shared merchant dictionary", async () => {
    mocks.lookup.mockResolvedValue(new Map());
    mocks.classify.mockImplementation(classifyingAs({ accountCode: null, verdict: "personal", reason: "개인 지출" }));
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");
    expect(dictionaryWrites()).toEqual([]);
  });

  it("logs verdict counts before and after normalization without PII", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.lookup.mockResolvedValue(new Map());
    mocks.classify.mockResolvedValue([{ accountCode: null, verdict: "personal", reason: "개인 지출" }]);
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "classify_verdicts",
      uploadId: "upload-1",
      before: { expense: 0, personal: 1, uncertain: 0 },
      after: { expense: 0, personal: 1, uncertain: 0 },
    });
    expect(JSON.stringify(logged)).not.toMatch(/UNIQUE_SHOP|개인 지출|CARD-9999/u);
    spy.mockRestore();
  });

  it.each([
    [new Error("storage"), "parse_failed", "download"],
    [new RowLimitExceeded(), "too_large", "normalize"],
    [new ClaudeCallError("schema"), "analysis_failed", "mapping"],
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

  // 날짜를 못 읽어 전 행이 버려졌는데 "분석 완료" 로 저장하면, 사용자는 경비가
  // 0원이라는 틀린 결론을 성공 화면에서 읽는다 (#29).
  it("fails instead of completing when every input row was skipped", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.normalizeRows.mockReturnValue({ txns: [], skipped: 5, excluded: 0 });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "failed", errorCode: "rows_unreadable" }),
    );
    expect(mocks.insertTxns).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  // 승인취소로 제외된 행은 읽기에 실패한 게 아니라 상태 판정이 성공한 결과다.
  // 실패로 돌리면 멀쩡한 파일을 다시 받으라고 안내하게 되고, 다시 올려도 결과가
  // 같아 사용자가 빠져나올 수 없다 (#36).
  it("completes with zero transactions when every input row was voided", async () => {
    mocks.normalizeRows.mockReturnValue({ txns: [], skipped: 0, excluded: 3 });
    mocks.period.mockReturnValue({ start: null, end: null });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "completed", errorCode: null, rowCount: 0 }),
    );
    expect(mocks.aggregate).toHaveBeenCalledWith(expect.any(Array), 3, false, 0);
  });

  // 읽지 못한 행이 하나라도 있으면 사용자가 원본을 다시 받아 조치할 여지가 있다.
  // 취소 제외가 섞였다는 이유로 완료로 넘기면 그 여지가 사라진다.
  it("still fails when unreadable rows are mixed with voided ones", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.normalizeRows.mockReturnValue({ txns: [], skipped: 2, excluded: 3 });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "failed", errorCode: "rows_unreadable" }),
    );
    expect(mocks.insertTxns).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("does not call it a failure when the file simply had no data rows", async () => {
    mocks.normalizeRows.mockReturnValue({ txns: [], skipped: 0, excluded: 0 });
    mocks.period.mockReturnValue({ start: null, end: null });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "completed" }),
    );
  });

  it("keeps analysing when only some of the rows were skipped", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 2, excluded: 0 });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "completed" }),
    );
    expect(mocks.aggregate).toHaveBeenCalledWith(expect.any(Array), 0, false, 2);
    vi.restoreAllMocks();
  });

  it("logs the row counts and nothing taken from the rows", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 2, excluded: 1 });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const line = spy.mock.calls
      .map((call) => String(call[0]))
      .find((text) => text.includes("normalize_rows"));
    const logged = JSON.parse(String(line)) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "normalize_rows",
      uploadId: "upload-1",
      inputRows: 4,
      normalized: 1,
      skipped: 2,
    });
    expect(JSON.stringify(logged)).not.toMatch(/UNIQUE_SHOP|2026-01-02|CARD-9999/u);
    spy.mockRestore();
  });

  it("stays quiet when no row was skipped", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const lines = spy.mock.calls.map((call) => String(call[0]));
    expect(lines.some((text) => text.includes("normalize_rows"))).toBe(false);
    spy.mockRestore();
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

  // 실패 로그만 보고 "몇 번째 배치에서 몇 개를 기대했는데 몇 개가 왔는지"를
  // 알 수 있어야 한다. 이게 없으면 재현을 기다리는 것 말고 할 수 있는 게 없다.
  it("logs the classify batch diagnosis when a batch fails validation", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookup.mockResolvedValue(new Map());
    mocks.classify.mockRejectedValue(
      new ClassifyBatchError({
        failureKind: "length_mismatch",
        batchNumber: 2,
        expectedCount: 47,
        actualCount: 46,
      }),
    );
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      uploadId: "upload-1",
      stage: "classify",
      batchNumber: 2,
      expectedCount: 47,
      actualCount: 46,
      failureKind: "length_mismatch",
    });
    spy.mockRestore();
  });

  it("omits the classify diagnosis for failures that are not batch validation", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookup.mockResolvedValue(new Map());
    mocks.classify.mockRejectedValue(new ClaudeCallError("refusal"));
    const { runAnalysis } = await import("./run-analysis");
    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).not.toHaveProperty("failureKind");
    expect(logged).not.toHaveProperty("batchNumber");
    spy.mockRestore();
  });
});

describe("runAnalysis upstream diagnostics", () => {
  const detail = {
    status: 429,
    errorType: "rate_limit_error",
    requestId: "req_011CQ",
    retryable: true,
  } as const;

  /** 저장되는 형태 — 출처와 단계가 붙는다. */
  const storedDetail = {
    source: "claude",
    stage: "classify",
    errorName: "ClaudeCallError",
    ...detail,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUpload.mockResolvedValue(upload);
    mocks.download.mockResolvedValue(new Uint8Array([1]));
    mocks.detectEncoding.mockReturnValue("utf-8");
    mocks.decodeCsv.mockReturnValue("CARD-9999,UNIQUE_CSV_CONTENT");
    mocks.parseRows.mockReturnValue(rows);
    mocks.fingerprint.mockReturnValue("fingerprint");
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 0, excluded: 0 });
    mocks.lookup.mockResolvedValue(new Map());
    mocks.upsert.mockResolvedValue({ inserted: 0, rejected: 0 });
    mocks.aggregate.mockReturnValue(summary);
    mocks.period.mockReturnValue({ start: "2026-01-02", end: "2026-01-02" });
    mocks.update.mockResolvedValue(undefined);
    mocks.removeTxns.mockResolvedValue(undefined);
    mocks.insertTxns.mockResolvedValue(undefined);
    mappingClient(true);
  });

  it("logs the upstream status, error type and request id", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.classify.mockRejectedValue(new ClaudeCallError("upstream", detail));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "analysis_failed",
      code: "upstream",
      upstreamStatus: 429,
      upstreamErrorType: "rate_limit_error",
      upstreamRequestId: "req_011CQ",
      upstreamRetryable: true,
    });
    spy.mockRestore();
  });

  it("persists the upstream detail on the upload without touching the fixed error code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.classify.mockRejectedValue(new ClaudeCallError("upstream", detail));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({
        status: "failed",
        errorCode: "upstream",
        errorDetail: storedDetail,
      }),
    );
  });

  it("clears a stale detail when the analysis succeeds", async () => {
    mocks.classify.mockResolvedValue([
      { accountCode: "supplies", verdict: "expense", reason: "fixture" },
    ]);
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "completed", errorDetail: null }),
    );
  });

  it("omits the upstream fields when the failure carries no detail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.classify.mockRejectedValue(new ClaudeCallError("upstream"));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).not.toHaveProperty("upstreamStatus");
    expect(logged).not.toHaveProperty("upstreamRequestId");
    spy.mockRestore();
  });

  // 앞 배치의 분류 결과를 버리면 재시도가 매번 처음부터 다시 돌고 같은 곳에서 죽는다.
  it("stores dictionary entries from batches that finished before the failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.classify.mockImplementation(
      async (
        _names: string[],
        options?: {
          onBatchComplete?: (batch: {
            names: string[];
            verdicts: { accountCode: string | null; verdict: string; reason: string | null }[];
          }) => Promise<void> | void;
        },
      ) => {
        await options?.onBatchComplete?.({
          names: ["UNIQUE_SHOP"],
          verdicts: [{ accountCode: "supplies", verdict: "expense", reason: "완료된 배치" }],
        });
        throw new ClaudeCallError("upstream", detail);
      },
    );
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        merchantKey: "unique_shop",
        accountCode: "supplies",
        defaultVerdict: "expense",
      }),
    ]);
  });

  // 국민카드 재현 — 고유 가맹점 131 개는 배치가 여러 개로 쪼개지는 첫 사례이고,
  // 실제로 여기서 두 번 연속 upstream 으로 죽었다.
  it("keeps the finished batches when a mid-run batch fails on 131 merchants", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const txns = Array.from({ length: 131 }, (_, index) => ({
      rowIndex: index + 1,
      txnDate: "2026-03-01",
      merchant: `가맹점 ${index + 1}호점`,
      amount: 1000,
    }));
    mocks.normalizeRows.mockReturnValue({ txns, skipped: 0, excluded: 0 });
    mocks.classify.mockImplementation(async (names: string[], options?: BatchOptions) => {
      const batchSize = CLASSIFY_BATCH_SIZE;
      for (let offset = 0; offset < names.length; offset += batchSize) {
        const batch = names.slice(offset, offset + batchSize);
        if (offset / batchSize === 2) {
          throw new ClaudeCallError("upstream", detail);
        }
        await options?.onBatchComplete?.({
          names: batch,
          verdicts: batch.map(() => ({
            accountCode: "supplies",
            verdict: "expense",
            reason: "합성 픽스처",
          })),
        });
      }
      throw new Error("unreachable");
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    // 앞 두 배치는 사전에 남아, 재시도가 캐시 적중으로 시작한다.
    expect(dictionaryWrites()).toHaveLength(CLASSIFY_BATCH_SIZE * 2);
    expect(mocks.insertTxns).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "failed", errorCode: "upstream", errorDetail: storedDetail }),
    );
  });

  // 국민카드 실패의 진짜 원인은 Claude 가 아니라 classify 단계의 DB 조회였는데,
  // 진단 정보를 ClaudeCallError 에만 달아 둬서 error_detail 이 null 로 남았다.
  it("diagnoses a database failure instead of leaving the detail null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dbFailure = Object.assign(new Error("column merchant_key does not exist"), {
      name: "PostgrestError",
      code: "42703",
    });
    mocks.lookup.mockRejectedValue(dbFailure);
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({
        status: "failed",
        errorCode: "upstream",
        errorDetail: expect.objectContaining({
          source: "database",
          stage: "classify",
          errorName: "PostgrestError",
          errorType: "42703",
        }),
      }),
    );
  });

  it("labels a Claude failure as such and keeps its upstream fields", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.classify.mockRejectedValue(new ClaudeCallError("upstream", detail));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({
        errorDetail: expect.objectContaining({
          source: "claude",
          stage: "classify",
          status: 429,
          errorType: "rate_limit_error",
        }),
      }),
    );
  });

  it("falls back to an internal diagnosis for a plain programming error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookup.mockRejectedValue(new TypeError("x is not a function"));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({
        errorDetail: expect.objectContaining({
          source: "internal",
          stage: "classify",
          errorName: "TypeError",
        }),
      }),
    );
  });

  // 상류·DB 메시지에는 행 내용이 섞여 나올 수 있다. 코드와 이름만 남긴다.
  it("never stores the error message in the detail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = "merchant 강남스타카페 row 42";
    mocks.lookup.mockRejectedValue(
      Object.assign(new Error(secret), { name: "PostgrestError", code: "23505" }),
    );
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const written = mocks.update.mock.calls.at(-1)?.[2] as { errorDetail: unknown };
    expect(JSON.stringify(written.errorDetail)).not.toContain("강남스타카페");
    expect(JSON.stringify(written.errorDetail)).not.toContain(secret);
  });

  it("logs the error name and stage so a non-Claude failure is identifiable", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookup.mockRejectedValue(
      Object.assign(new Error("boom"), { name: "PostgrestError", code: "57014" }),
    );
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "analysis_failed",
      code: "upstream",
      errorSource: "database",
      errorName: "PostgrestError",
      errorType: "57014",
      stage: "classify",
    });
    spy.mockRestore();
  });

  // 실패한 업로드에도 "몇 행까지 갔는지"가 남아야 원인 범위를 좁힐 수 있다.
  it("records how many rows were normalized even when the run fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookup.mockRejectedValue(new Error("db down"));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "failed", rowCount: normalized.length }),
    );
  });

  // mapping 은 CSV 를 읽는 단계가 아니라 Claude 를 부르는 단계다. parse_failed 로
  // 적으면 화면이 "CSV 파일을 읽지 못했습니다" 라고 말해 멀쩡한 파일을 의심하게 한다.
  it("records a mapping-columns Claude failure as analysis_failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mappingClient(false);
    mocks.mapColumns.mockRejectedValue(new ClaudeCallError("json_parse"));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({
        status: "failed",
        errorCode: "analysis_failed",
        errorDetail: expect.objectContaining({ stage: "mapping-columns" }),
      }),
    );
  });

  it("stores the response shape diagnosis and labels the failure as Claude's", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const shape = {
      textLength: 42,
      startsWithFence: true,
      firstCharKind: "backtick",
      stopReason: "end_turn",
    };
    mappingClient(false);
    mocks.mapColumns.mockRejectedValue(new ClaudeCallError("json_parse", null, shape));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const written = mocks.update.mock.calls.at(-1)?.[2] as { errorDetail: unknown };
    expect(written.errorDetail).toMatchObject({
      source: "claude",
      stage: "mapping-columns",
      errorName: "ClaudeCallError",
      responseShape: shape,
    });
    expect(JSON.stringify(written.errorDetail)).not.toMatch(
      /UNIQUE_SHOP|UNIQUE_CSV_CONTENT|CARD-9999|```/u,
    );
  });

  it("logs the response shape so the next failure needs no reproduction", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mappingClient(false);
    mocks.mapColumns.mockRejectedValue(
      new ClaudeCallError("json_parse", null, {
        textLength: 42,
        startsWithFence: true,
        firstCharKind: "backtick",
        stopReason: "end_turn",
      }),
    );
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "analysis_failed",
      code: "analysis_failed",
      stage: "mapping-columns",
      llmKind: "json_parse",
      startsWithFence: true,
      firstCharKind: "backtick",
      stopReason: "end_turn",
    });
    spy.mockRestore();
  });

  // 0 은 "0행을 정규화했다" 는 측정값처럼 읽힌다. 정규화에 도달조차 못했으면
  // 측정이 없었다는 뜻이므로 null 이어야 한다.
  it("leaves the row count null when the run fails before normalization", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mappingClient(false);
    mocks.mapColumns.mockRejectedValue(new ClaudeCallError("json_parse"));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "failed", rowCount: null }),
    );
  });

  // 실패 기록마저 실패하면 업로드가 processing 에 영원히 갇힌다. 조용히 삼키지 않는다.
  it("reports when persisting the failure itself fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.lookup.mockRejectedValue(new Error("db down"));
    mocks.update.mockRejectedValue(new Error("update rejected"));
    const { runAnalysis } = await import("./run-analysis");

    await expect(runAnalysis("user-1", "upload-1")).resolves.toBeUndefined();

    const events = spy.mock.calls.map(
      (call) => (JSON.parse(String(call[0])) as { event: string }).event,
    );
    expect(events).toContain("analysis_record_failed");
    spy.mockRestore();
  });

  // ADR-023 과 같은 이유로 personal 은 사용자 간 공유 사전에 남기지 않는다.
  it("keeps personal verdicts out of the shared dictionary in the per-batch path", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.classify.mockImplementation(
      async (
        _names: string[],
        options?: {
          onBatchComplete?: (batch: {
            names: string[];
            verdicts: { accountCode: string | null; verdict: string; reason: string | null }[];
          }) => Promise<void> | void;
        },
      ) => {
        await options?.onBatchComplete?.({
          names: ["UNIQUE_SHOP"],
          verdicts: [{ accountCode: null, verdict: "personal", reason: "개인 지출" }],
        });
        throw new ClaudeCallError("upstream", detail);
      },
    );
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    for (const [entries] of mocks.upsert.mock.calls as [unknown[]][]) {
      expect(entries).toHaveLength(0);
    }
  });
});

describe("runAnalysis 상태 사전", () => {
  const statusRows = [
    ["date", "merchant", "amount", "status"],
    ["2026-01-02", "UNIQUE_SHOP", "1000", "전표매입"],
    ["2026-01-03", "UNIQUE_SHOP", "2000", "승인취소"],
  ];
  const statusColumnMap = { date: 0, merchant: 1, amount: 2, txnType: 3 };
  const rules = { 전표매입: "normal", 승인취소: "void" };

  function cachedColumnMap() {
    return mocks.mappingUpsert.mock.calls[0]?.[0].column_map as Record<string, unknown>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUpload.mockResolvedValue(upload);
    mocks.download.mockResolvedValue(new Uint8Array([1]));
    mocks.detectEncoding.mockReturnValue("utf-8");
    mocks.decodeCsv.mockReturnValue("UNIQUE_CSV_CONTENT");
    mocks.parseRows.mockReturnValue(statusRows);
    mocks.fingerprint.mockReturnValue("fingerprint");
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 0, excluded: 1 });
    mocks.mapStatus.mockResolvedValue({ rules, unresolved: 0, failureKind: null });
    mocks.lookup.mockResolvedValue(dictionaryHit());
    mocks.upsert.mockResolvedValue({ inserted: 0, rejected: 0 });
    mocks.aggregate.mockReturnValue(summary);
    mocks.period.mockReturnValue({ start: "2026-01-02", end: "2026-01-02" });
    mocks.update.mockResolvedValue(undefined);
    mocks.removeTxns.mockResolvedValue(undefined);
    mocks.insertTxns.mockResolvedValue(undefined);
    mappingClient(true, statusColumnMap);
  });

  it("asks Claude for the distinct status values and caches the answer", async () => {
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.mapStatus).toHaveBeenCalledWith(["전표매입", "승인취소"]);
    expect(cachedColumnMap()).toEqual({ ...statusColumnMap, txnTypeRules: rules });
  });

  it("passes the cached rules to normalizeRows", async () => {
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.normalizeRows).toHaveBeenCalledWith(
      statusRows,
      expect.objectContaining({ txnTypeRules: rules }),
      0,
    );
  });

  it("reuses a cached dictionary without calling Claude", async () => {
    mappingClient(true, { ...statusColumnMap, txnTypeRules: rules });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.mapStatus).not.toHaveBeenCalled();
    expect(mocks.mappingUpsert).not.toHaveBeenCalled();
  });

  it("asks only about status values the cache has never seen", async () => {
    mappingClient(true, { ...statusColumnMap, txnTypeRules: { 전표매입: "normal" } });
    mocks.mapStatus.mockResolvedValue({
      rules: { 승인취소: "void" },
      unresolved: 0,
      failureKind: null,
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.mapStatus).toHaveBeenCalledWith(["승인취소"]);
    expect(cachedColumnMap().txnTypeRules).toEqual(rules);
  });

  it("skips the status call entirely when the format has no status column", async () => {
    mocks.parseRows.mockReturnValue(rows);
    mappingClient(true, mapping.columnMap);
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.mapStatus).not.toHaveBeenCalled();
    expect(mocks.mappingUpsert).not.toHaveBeenCalled();
  });

  it("hands the excluded count to aggregate", async () => {
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.aggregate).toHaveBeenCalledWith(expect.any(Array), 1, false, 0);
  });

  it("keeps transaction content out of the shared mapping cache", async () => {
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const payload = JSON.stringify(mocks.mappingUpsert.mock.calls[0]![0]);
    expect(payload).not.toContain("UNIQUE_SHOP");
    expect(payload).not.toContain("UNIQUE_CSV_CONTENT");
    expect(payload).not.toContain("user-1");
  });

  // 상태 판정 하나가 실패했다고 309행짜리 명세서를 통째로 버리지 않는다.
  // 사전에 빠진 값은 normalize 가 normal 로 읽으므로 분석은 그대로 끝난다.
  it("completes the upload when the status mapping falls back", async () => {
    mocks.mapStatus.mockResolvedValue({
      rules: {},
      unresolved: 1,
      failureKind: "json_parse",
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({ status: "completed", errorCode: null }),
    );
    expect(mocks.insertTxns).toHaveBeenCalled();
  });

  // 폴백한 normal 을 캐시에 굳히면 이후 이 양식의 모든 업로드가 조용히 오염된다.
  it("never writes a fallback verdict to the shared mapping cache", async () => {
    mocks.mapStatus.mockResolvedValue({
      rules: {},
      unresolved: 2,
      failureKind: "json_parse",
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.mappingUpsert).not.toHaveBeenCalled();
  });

  it("caches the values it did resolve and leaves the fallback out", async () => {
    mocks.mapStatus.mockResolvedValue({
      rules: { 전표매입: "normal" },
      unresolved: 1,
      failureKind: "schema",
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(cachedColumnMap().txnTypeRules).toEqual({ 전표매입: "normal" });
  });

  it("asks the report for a warning when a status stayed unresolved", async () => {
    mocks.mapStatus.mockResolvedValue({
      rules: {},
      unresolved: 1,
      failureKind: "json_parse",
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.aggregate).toHaveBeenCalledWith(expect.any(Array), 1, true, 0);
  });

  it("logs the fallback with a count and a kind but no status value", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.mapStatus.mockResolvedValue({
      rules: {},
      unresolved: 2,
      failureKind: "json_parse",
    });
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const logged = JSON.parse(String(spy.mock.calls.at(-1)?.[0])) as Record<string, unknown>;
    expect(logged).toMatchObject({
      event: "status_mapping_fallback",
      uploadId: "upload-1",
      unresolved: 2,
      llmKind: "json_parse",
    });
    expect(JSON.stringify(logged)).not.toMatch(/전표매입|승인취소|UNIQUE_SHOP/u);
    spy.mockRestore();
  });

  it("names the status stage when the status mapping itself throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.mapStatus.mockRejectedValue(new TypeError("x is not a function"));
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    expect(mocks.update).toHaveBeenLastCalledWith(
      "user-1",
      "upload-1",
      expect.objectContaining({
        status: "failed",
        errorDetail: expect.objectContaining({ stage: "mapping-status", source: "internal" }),
      }),
    );
    vi.restoreAllMocks();
  });

  it("keeps status values out of the logs", async () => {
    const spies = [
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    const { runAnalysis } = await import("./run-analysis");

    await runAnalysis("user-1", "upload-1");

    const logged = spies.flatMap((spy) => spy.mock.calls.map((args) => String(args[0])));
    for (const line of logged) {
      expect(line).not.toContain("전표매입");
      expect(line).not.toContain("UNIQUE_SHOP");
    }
    vi.restoreAllMocks();
  });
});
