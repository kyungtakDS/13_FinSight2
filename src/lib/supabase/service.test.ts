import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

function queryResult(data: unknown = null) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    or: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.or.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
  chain.single.mockResolvedValue({ data, error: null });
  chain.maybeSingle.mockResolvedValue({ data, error: null });
  return chain;
}

describe("service-role Supabase access", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mocks.createClient.mockReturnValue({
      from: mocks.from,
      rpc: mocks.rpc,
      storage: { from: mocks.storageFrom },
    });
    mocks.storageFrom.mockReturnValue({
      download: mocks.download,
      remove: mocks.remove,
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("requires userId as the first parameter of every data helper", async () => {
    const serviceModule = await import("./service");
    const source = await readFile(
      join(process.cwd(), "src/lib/supabase/service.ts"),
      "utf8",
    );
    const helpers = [
      "getProfilePlan",
      "getUploadForUser",
      "updateUploadForUser",
      "claimUploadRetry",
      "claimUploadRecompute",
      "releaseUploadRecompute",
      "replaceUploadResultForUser",
      "insertTransactionsForUser",
      "deleteTransactionsForUser",
      "downloadOriginalForUser",
      "deleteOriginalForUser",
    ] as const;

    for (const helper of helpers) {
      expect(serviceModule[helper].length).toBeGreaterThanOrEqual(1);
      expect(source).toMatch(
        new RegExp(`function\\s+${helper}\\s*\\(\\s*userId:\\s*string`),
      );
    }
  });

  it("creates a stateless service-role client lazily", async () => {
    const serviceModule = await import("./service");

    expect(mocks.createClient).not.toHaveBeenCalled();
    serviceModule.createServiceClient();
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "service-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  });

  it("does not validate missing environment variables until factory use", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const serviceModule = await import("./service");

    expect(() => serviceModule.createServiceClient()).toThrow(
      "missing env: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("scopes profile and upload reads to userId", async () => {
    const profileQuery = queryResult({ plan: "pro" });
    const uploadQuery = queryResult(null);
    mocks.from
      .mockReturnValueOnce(profileQuery)
      .mockReturnValueOnce(uploadQuery);
    const { getProfilePlan, getUploadForUser } = await import("./service");

    await expect(getProfilePlan("user-1")).resolves.toBe("pro");
    await expect(getUploadForUser("user-1", "upload-1")).resolves.toBeNull();
    expect(profileQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(uploadQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(uploadQuery.eq).toHaveBeenCalledWith("id", "upload-1");
  });

  it("scopes upload updates to both userId and uploadId", async () => {
    const query = queryResult();
    mocks.from.mockReturnValue(query);
    const { updateUploadForUser } = await import("./service");

    await updateUploadForUser("user-1", "upload-1", { status: "completed" });

    expect(query.update).toHaveBeenCalledWith({ status: "completed" });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("id", "upload-1");
  });

  it("claims a retry with a compare-and-swap on status and retry_count", async () => {
    const query = queryResult();
    query.select.mockResolvedValue({ data: [{ id: "upload-1" }], error: null });
    mocks.from.mockReturnValue(query);
    const { claimUploadRetry } = await import("./service");

    await expect(claimUploadRetry("user-1", "upload-1", 1)).resolves.toBe(true);

    expect(query.update).toHaveBeenCalledWith({
      retry_count: 2,
      status: "processing",
      error_code: null,
      finished_at: null,
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("id", "upload-1");
    expect(query.eq).toHaveBeenCalledWith("status", "failed");
    expect(query.eq).toHaveBeenCalledWith("retry_count", 1);
  });

  it("reports a lost retry race when the guarded update matches no row", async () => {
    const query = queryResult();
    query.select.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(query);
    const { claimUploadRetry } = await import("./service");

    await expect(claimUploadRetry("user-1", "upload-1", 0)).resolves.toBe(false);
  });

  it("claims a recompute with a compare-and-swap on status and a stale lock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T00:00:00.000Z"));
    const query = queryResult();
    query.select.mockResolvedValue({ data: [{ id: "upload-1" }], error: null });
    mocks.from.mockReturnValue(query);
    const { claimUploadRecompute } = await import("./service");

    await expect(claimUploadRecompute("user-1", "upload-1")).resolves.toBe(true);

    expect(query.update).toHaveBeenCalledWith({
      recompute_started_at: "2026-08-07T00:00:00.000Z",
    });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("id", "upload-1");
    expect(query.eq).toHaveBeenCalledWith("status", "completed");
    expect(query.or).toHaveBeenCalledWith(
      "recompute_started_at.is.null,recompute_started_at.lt.2026-08-06T23:45:00.000Z",
    );
    vi.useRealTimers();
  });

  it("does not touch status or retry_count when claiming a recompute", async () => {
    const query = queryResult();
    query.select.mockResolvedValue({ data: [{ id: "upload-1" }], error: null });
    mocks.from.mockReturnValue(query);
    const { claimUploadRecompute } = await import("./service");

    await claimUploadRecompute("user-1", "upload-1");

    const [patch] = query.update.mock.calls[0] as [Record<string, unknown>];
    expect(Object.keys(patch)).toEqual(["recompute_started_at"]);
  });

  it("reports a lost recompute race when the guarded update matches no row", async () => {
    const query = queryResult();
    query.select.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(query);
    const { claimUploadRecompute } = await import("./service");

    await expect(claimUploadRecompute("user-1", "upload-1")).resolves.toBe(false);
  });

  it("releases the recompute lock without changing the stored result", async () => {
    const query = queryResult();
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ error: null });
    mocks.from.mockReturnValue(query);
    const { releaseUploadRecompute } = await import("./service");

    await releaseUploadRecompute("user-1", "upload-1");

    expect(query.update).toHaveBeenCalledWith({ recompute_started_at: null });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("id", "upload-1");
  });

  it("treats only a lock inside the 15 minute window as running", async () => {
    const { isRecomputing, RECOMPUTE_LOCK_MS } = await import("./service");

    expect(RECOMPUTE_LOCK_MS).toBe(15 * 60 * 1000);
    expect(isRecomputing(null)).toBe(false);
    expect(isRecomputing(new Date(Date.now() - 60_000).toISOString())).toBe(true);
    expect(
      isRecomputing(new Date(Date.now() - RECOMPUTE_LOCK_MS - 1_000).toISOString()),
    ).toBe(false);
  });

  it("replaces transactions and summary in a single RPC call", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { replaceUploadResultForUser } = await import("./service");
    const summary = { expenseTotal: 1000 } as never;

    await replaceUploadResultForUser(
      "user-1",
      "upload-1",
      [
        {
          rowIndex: 4,
          txnDate: "2026-07-31",
          merchant: "merchant",
          amount: 12000,
          accountCode: "supplies",
          verdict: "expense",
        },
      ],
      {
        summary,
        periodStart: "2026-07-01",
        periodEnd: "2026-07-31",
        rowCount: 1,
      },
    );

    expect(mocks.rpc).toHaveBeenCalledWith("replace_upload_result", {
      p_user_id: "user-1",
      p_upload_id: "upload-1",
      p_transactions: [
        {
          row_index: 4,
          txn_date: "2026-07-31",
          merchant: "merchant",
          amount: 12000,
          account_code: "supplies",
          verdict: "expense",
        },
      ],
      p_summary: summary,
      p_period_start: "2026-07-01",
      p_period_end: "2026-07-31",
      p_row_count: 1,
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("surfaces a failed replacement instead of reporting success", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "P0002" } });
    const { replaceUploadResultForUser } = await import("./service");

    await expect(
      replaceUploadResultForUser("user-1", "upload-1", [], {
        summary: null as never,
        periodStart: null,
        periodEnd: null,
        rowCount: 0,
      }),
    ).rejects.toMatchObject({ code: "P0002" });
  });

  it("inserts transaction rows with user and upload ownership", async () => {
    const query = queryResult();
    query.insert.mockResolvedValue({ error: null });
    mocks.from.mockReturnValue(query);
    const { insertTransactionsForUser } = await import("./service");

    await insertTransactionsForUser("user-1", "upload-1", [
      {
        rowIndex: 4,
        txnDate: "2026-07-31",
        merchant: "merchant",
        amount: 12000,
        accountCode: "supplies",
        verdict: "expense",
      },
    ]);

    expect(query.insert).toHaveBeenCalledWith([
      {
        user_id: "user-1",
        upload_id: "upload-1",
        row_index: 4,
        txn_date: "2026-07-31",
        merchant: "merchant",
        amount: 12000,
        account_code: "supplies",
        verdict: "expense",
      },
    ]);
  });

  it("deletes prior transaction rows within both user and upload scope", async () => {
    const query = queryResult();
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ error: null });
    mocks.from.mockReturnValue(query);
    const { deleteTransactionsForUser } = await import("./service");

    await deleteTransactionsForUser("user-1", "upload-1");

    expect(mocks.from).toHaveBeenCalledWith("transactions");
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("upload_id", "upload-1");
  });

  it("rejects cross-user storage paths before touching storage", async () => {
    const { deleteOriginalForUser, downloadOriginalForUser } = await import(
      "./service"
    );

    await expect(
      downloadOriginalForUser("user-1", "user-2/upload.csv"),
    ).rejects.toThrow("storage path is outside user scope");
    await expect(
      deleteOriginalForUser("user-1", "user-2/upload.csv"),
    ).rejects.toThrow("storage path is outside user scope");
    expect(mocks.storageFrom).not.toHaveBeenCalled();
  });

  it("downloads and deletes only user-scoped original files", async () => {
    mocks.download.mockResolvedValue({
      data: new Blob([new Uint8Array([1, 2, 3])]),
      error: null,
    });
    mocks.remove.mockResolvedValue({ error: null });
    const { deleteOriginalForUser, downloadOriginalForUser, storagePathFor } =
      await import("./service");
    const path = storagePathFor("user-1", "upload-1");

    expect(path).toBe("user-1/upload-1.csv");
    await expect(downloadOriginalForUser("user-1", path)).resolves.toEqual(
      new Uint8Array([1, 2, 3]),
    );
    await deleteOriginalForUser("user-1", path);

    expect(mocks.storageFrom).toHaveBeenCalledWith("csv-uploads");
    expect(mocks.download).toHaveBeenCalledWith(path);
    expect(mocks.remove).toHaveBeenCalledWith([path]);
  });
});
