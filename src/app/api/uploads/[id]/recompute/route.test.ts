import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUploadForUser: vi.fn(),
  updateUploadForUser: vi.fn(),
  claimUploadRecompute: vi.fn(),
  claimUploadRetry: vi.fn(),
  runAnalysis: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/supabase/service", () => ({
  getUploadForUser: mocks.getUploadForUser,
  updateUploadForUser: mocks.updateUploadForUser,
  claimUploadRecompute: mocks.claimUploadRecompute,
  claimUploadRetry: mocks.claimUploadRetry,
}));
vi.mock("@/lib/analysis/run-analysis", () => ({ runAnalysis: mocks.runAnalysis }));
vi.mock("next/server", () => ({ after: mocks.after }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UPLOAD_ID = "22222222-2222-4222-8222-222222222222";
const ctx = { params: Promise.resolve({ id: UPLOAD_ID }) };
const request = () =>
  new Request(`http://localhost/api/uploads/${UPLOAD_ID}/recompute`, { method: "POST" });

function upload(overrides: Record<string, unknown> = {}) {
  return {
    id: UPLOAD_ID, userId: USER_ID, storagePath: `${USER_ID}/${UPLOAD_ID}.csv`,
    filename: "PRIVATE_FILE.csv", fileHash: "hash", status: "completed",
    errorCode: null, errorDetail: null, retryCount: 1, periodStart: "2026-01-01",
    periodEnd: "2026-01-31", rowCount: 309, summary: { expenseTotal: 1 },
    expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:01:00.000Z",
    recomputeStartedAt: null, recomputedAt: null, ...overrides,
  };
}

describe("POST /api/uploads/[id]/recompute", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.getUploadForUser.mockResolvedValue(upload());
    mocks.updateUploadForUser.mockResolvedValue(undefined);
    mocks.claimUploadRecompute.mockResolvedValue(true);
    mocks.runAnalysis.mockResolvedValue(undefined);
    mocks.after.mockImplementation(() => undefined);
  });

  it("requires authentication", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(401);
    expect(mocks.getUploadForUser).not.toHaveBeenCalled();
  });

  it.each(["absent", "foreign"])("returns 404 for an %s upload", async () => {
    mocks.getUploadForUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(404);
  });

  it.each([
    [{ expiresAt: "2020-01-01T00:00:00.000Z" }, "past expiry"],
    [{ storagePath: null }, "missing original"],
  ])("rejects %s with expired and no claim", async (overrides) => {
    mocks.getUploadForUser.mockResolvedValue(upload(overrides));
    const { POST } = await import("./route");
    const response = await POST(request(), ctx);
    expect([response.status, await response.json()]).toEqual([409, { error: "expired" }]);
    expect(mocks.claimUploadRecompute).not.toHaveBeenCalled();
  });

  it.each(["processing", "failed"])("rejects %s uploads", async (status) => {
    mocks.getUploadForUser.mockResolvedValue(upload({ status }));
    const { POST } = await import("./route");
    const response = await POST(request(), ctx);
    expect([response.status, await response.json()]).toEqual([
      409,
      { error: "analysis_failed" },
    ]);
    expect(mocks.claimUploadRecompute).not.toHaveBeenCalled();
  });

  it("rejects a lost claim with fixed vocabulary and no analysis", async () => {
    mocks.claimUploadRecompute.mockResolvedValue(false);
    const { POST } = await import("./route");
    const response = await POST(request(), ctx);
    expect([response.status, await response.json()]).toEqual([
      409,
      { error: "analysis_failed" },
    ]);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("returns 202 after claiming the lock", async () => {
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(202);
    expect(mocks.claimUploadRecompute).toHaveBeenCalledWith(USER_ID, UPLOAD_ID);
  });

  it("claims before scheduling after", async () => {
    const order: string[] = [];
    mocks.claimUploadRecompute.mockImplementation(async () => { order.push("claim"); return true; });
    mocks.after.mockImplementation(() => { order.push("after"); });
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(order).toEqual(["claim", "after"]);
  });

  it("schedules runAnalysis in recompute mode through after", async () => {
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(mocks.after).toHaveBeenCalledOnce();
    await mocks.after.mock.calls[0]![0]();
    expect(mocks.runAnalysis).toHaveBeenCalledWith(USER_ID, UPLOAD_ID, { recompute: true });
  });

  it("does not await the analysis", async () => {
    mocks.runAnalysis.mockReturnValue(new Promise(() => undefined));
    const { POST } = await import("./route");
    await expect(POST(request(), ctx)).resolves.toMatchObject({ status: 202 });
  });

  // 재계산은 실패 재시도 한도를 쓰지 않는다. 라우트가 retry 경로를 건드리면
  // 재계산 한 번에 남은 재시도가 사라진다.
  it("never consumes a retry or writes the upload row", async () => {
    const { POST } = await import("./route");
    await POST(request(), ctx);
    expect(mocks.claimUploadRetry).not.toHaveBeenCalled();
    expect(mocks.updateUploadForUser).not.toHaveBeenCalled();
  });

  it("lets only one of two concurrent recomputes win the claim", async () => {
    let claimed = false;
    mocks.claimUploadRecompute.mockImplementation(async () => {
      await Promise.resolve();
      if (claimed) return false;
      claimed = true;
      return true;
    });
    const { POST } = await import("./route");

    const [first, second] = await Promise.all([POST(request(), ctx), POST(request(), ctx)]);

    expect([first.status, second.status].sort()).toEqual([202, 409]);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("logs no filename or merchant data", async () => {
    mocks.claimUploadRecompute.mockRejectedValue(new Error("PRIVATE_FILE.csv UNIQUE_MERCHANT"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("./route");
    expect((await POST(request(), ctx)).status).toBe(500);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/PRIVATE_FILE|UNIQUE_MERCHANT/u);
    spy.mockRestore();
  });
});
