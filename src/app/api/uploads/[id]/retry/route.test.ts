import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUploadForUser: vi.fn(),
  updateUploadForUser: vi.fn(),
  claimUploadRetry: vi.fn(),
  runAnalysis: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/supabase/service", () => ({
  getUploadForUser: mocks.getUploadForUser,
  updateUploadForUser: mocks.updateUploadForUser,
  claimUploadRetry: mocks.claimUploadRetry,
}));
vi.mock("@/lib/analysis/run-analysis", () => ({ runAnalysis: mocks.runAnalysis }));
vi.mock("next/server", () => ({ after: mocks.after }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UPLOAD_ID = "22222222-2222-4222-8222-222222222222";
const ctx = { params: Promise.resolve({ id: UPLOAD_ID }) };
const request = () => new Request(`http://localhost/api/uploads/${UPLOAD_ID}/retry`, { method: "POST" });

function upload(overrides: Record<string, unknown> = {}) {
  return {
    id: UPLOAD_ID, userId: USER_ID, storagePath: `${USER_ID}/${UPLOAD_ID}.csv`,
    filename: "PRIVATE_FILE.csv", fileHash: "hash", status: "failed",
    errorCode: "analysis_failed", retryCount: 0, periodStart: null, periodEnd: null,
    rowCount: 1, summary: null, expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z", startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:01:00.000Z", ...overrides,
  };
}

describe("POST /api/uploads/[id]/retry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.getUploadForUser.mockResolvedValue(upload());
    mocks.updateUploadForUser.mockResolvedValue(undefined);
    mocks.claimUploadRetry.mockResolvedValue(true);
    mocks.runAnalysis.mockResolvedValue(undefined);
    mocks.after.mockImplementation(() => undefined);
  });

  it("1. requires authentication", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(401);
  });

  it.each(["absent", "foreign"])("2-3. returns 404 for an %s upload", async () => {
    mocks.getUploadForUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(404);
  });

  it.each(["processing", "completed"])("4-5. rejects %s uploads", async (status) => {
    mocks.getUploadForUser.mockResolvedValue(upload({ status }));
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(409);
    expect(mocks.claimUploadRetry).not.toHaveBeenCalled();
  });

  it("6. rejects retry_count 2 with fixed vocabulary and no retries left", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ retryCount: 2 }));
    const { POST } = await import("./route");
    const response = await POST(request(), ctx);
    expect([response.status, await response.json()]).toEqual([409, { error: "analysis_failed", retriesLeft: 0 }]);
  });

  it("7. increments retry_count from the count it observed", async () => {
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(mocks.claimUploadRetry).toHaveBeenCalledWith(USER_ID, UPLOAD_ID, 0);
  });

  it("8. persists the transition before scheduling after", async () => {
    const order: string[] = [];
    mocks.claimUploadRetry.mockImplementation(async () => { order.push("claim"); return true; });
    mocks.after.mockImplementation(() => { order.push("after"); });
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(order).toEqual(["claim", "after"]);
  });

  it("9. changes count and status in one guarded update", async () => {
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(mocks.claimUploadRetry).toHaveBeenCalledTimes(1);
    expect(mocks.updateUploadForUser).not.toHaveBeenCalled();
  });

  it("10. returns the remaining retry count", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ retryCount: 1 }));
    const { POST } = await import("./route");
    expect(await (await POST(request(), ctx)).json()).toEqual({ retriesLeft: 0 });
  });

  it.each([
    [{ expiresAt: "2020-01-01T00:00:00.000Z" }, "past expiry"],
    [{ storagePath: null }, "missing original"],
  ])("11. rejects expired uploads with expired for %s", async (overrides) => {
    mocks.getUploadForUser.mockResolvedValue(upload(overrides));
    const { POST } = await import("./route");
    const response = await POST(request(), ctx);
    expect([response.status, await response.json()]).toEqual([409, { error: "expired" }]);
  });

  it("12. does not consume a retry for expiry", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ storagePath: null }));
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(mocks.claimUploadRetry).not.toHaveBeenCalled();
  });

  it("13. checks expiry before retry exhaustion", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ storagePath: null, retryCount: 2 }));
    const { POST } = await import("./route");
    expect(await (await POST(request(), ctx)).json()).toEqual({ error: "expired" });
  });

  it("14. schedules runAnalysis through after", async () => {
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(mocks.after).toHaveBeenCalledOnce();
    await mocks.after.mock.calls[0]![0]();
    expect(mocks.runAnalysis).toHaveBeenCalledWith(USER_ID, UPLOAD_ID);
  });

  it("15. does not await analysis", async () => {
    mocks.runAnalysis.mockReturnValue(new Promise(() => undefined));
    const { POST } = await import("./route");
    await expect(POST(request(), ctx)).resolves.toMatchObject({ status: 202 });
  });

  it("16. returns 202 after accepting", async () => {
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(202);
  });

  it("17-18. rejects a lost claim with fixed vocabulary and no analysis", async () => {
    mocks.claimUploadRetry.mockResolvedValue(false);
    const { POST } = await import("./route");
    const response = await POST(request(), ctx);
    expect([response.status, await response.json()]).toEqual([409, { error: "analysis_failed" }]);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("19. rejects the immediate second request after the first changes status", async () => {
    let current = upload();
    mocks.getUploadForUser.mockImplementation(async () => current);
    mocks.claimUploadRetry.mockImplementation(async (_userId, _id, expected) => {
      if (current.status !== "failed" || current.retryCount !== expected) return false;
      current = { ...current, status: "processing", retryCount: expected + 1 };
      return true;
    });
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(202);
    expect((await POST(request(), ctx)).status).toBe(409);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("21. lets only one of two concurrent retries win the claim", async () => {
    const stored = upload();
    mocks.getUploadForUser.mockResolvedValue(stored);
    let claimed = false;
    mocks.claimUploadRetry.mockImplementation(async (_userId, _id, expected) => {
      await Promise.resolve();
      if (claimed || stored.retryCount !== expected) return false;
      claimed = true;
      return true;
    });
    const { POST } = await import("./route");

    const [first, second] = await Promise.all([POST(request(), ctx), POST(request(), ctx)]);

    expect([first.status, second.status].sort()).toEqual([202, 409]);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("20. logs no filename or merchant data", async () => {
    mocks.claimUploadRetry.mockRejectedValue(new Error("PRIVATE_FILE.csv UNIQUE_MERCHANT"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("./route");
    await POST(request(), ctx);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toMatch(/PRIVATE_FILE|UNIQUE_MERCHANT/u);
    spy.mockRestore();
  });
});
