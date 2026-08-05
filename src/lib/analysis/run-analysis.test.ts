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

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUpload.mockResolvedValue(upload);
    mocks.download.mockResolvedValue(new Uint8Array([1]));
    mocks.detectEncoding.mockReturnValue("utf-8");
    mocks.decodeCsv.mockReturnValue("CARD-9999,UNIQUE_CSV_CONTENT");
    mocks.parseRows.mockReturnValue(rows);
    mocks.fingerprint.mockReturnValue("fingerprint");
    mocks.normalizeRows.mockReturnValue({ txns: normalized, skipped: 0 });
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
        errorDetail: detail,
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
    mocks.normalizeRows.mockReturnValue({ txns, skipped: 0 });
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
      expect.objectContaining({ status: "failed", errorCode: "upstream", errorDetail: detail }),
    );
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
