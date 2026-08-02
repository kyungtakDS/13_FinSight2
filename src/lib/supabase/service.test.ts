import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
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
    single: vi.fn(),
    maybeSingle: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
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
      "insertTransactionsForUser",
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
