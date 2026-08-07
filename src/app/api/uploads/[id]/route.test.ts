import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), createClient: vi.fn(), getUploadForUser: vi.fn(),
  getProfilePlan: vi.fn(), deleteOriginalForUser: vi.fn(), from: vi.fn(),
  txnMaybe: vi.fn(), deleteMaybe: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mocks.getUser, createClient: mocks.createClient }));
// isRecomputing 은 15분 잠금 창을 CAS 와 한 곳에서 정의한다. mock 으로 갈아치우면
// 그 창이 응답에 실제로 반영되는지 검증할 수 없다.
vi.mock("@/lib/supabase/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/service")>()),
  getUploadForUser: mocks.getUploadForUser,
  getProfilePlan: mocks.getProfilePlan,
  deleteOriginalForUser: mocks.deleteOriginalForUser,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UPLOAD_ID = "22222222-2222-4222-8222-222222222222";
const MERCHANT = "UNIQUE_SECRET_MERCHANT";
const insights = Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, title: `title ${i}`, body: `body ${i}` }));
const summary = { expenseTotal: 1000, personalTotal: 0, uncertainCount: 0, uncertainTotal: 0,
  estimatedSaving: 100, taxRate: 0.1, accounts: [], insights, txnCount: 1 };
const txn = { rowIndex: 1, txnDate: "2026-01-01", merchant: MERCHANT, amount: 1000,
  accountCode: "supplies", verdict: "expense" };

function upload(overrides: Record<string, unknown> = {}) {
  return { id: UPLOAD_ID, userId: USER_ID, storagePath: `${USER_ID}/${UPLOAD_ID}.csv`, filename: "private.csv",
    fileHash: "hash", status: "completed", errorCode: null, retryCount: 0, periodStart: "2026-01-01",
    periodEnd: "2026-01-31", rowCount: 1, summary, expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z", startedAt: "2026-01-01T00:00:00.000Z",
    finishedAt: "2026-01-01T00:01:00.000Z", recomputeStartedAt: null, recomputedAt: null,
    ...overrides };
}

function chain(terminal: () => unknown) {
  const value: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "delete"]) value[method] = vi.fn(() => value);
  value.then = (resolve: (value: unknown) => unknown) => Promise.resolve(terminal()).then(resolve);
  return value;
}

const ctx = { params: Promise.resolve({ id: UPLOAD_ID }) };
const req = (method = "GET", suffix = "") => new Request(`http://localhost/api/uploads/${UPLOAD_ID}${suffix}`, { method });

describe("/api/uploads/[id]", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.getUploadForUser.mockResolvedValue(upload());
    mocks.getProfilePlan.mockResolvedValue("free");
    mocks.deleteOriginalForUser.mockResolvedValue(undefined);
    mocks.txnMaybe.mockReturnValue({ data: [txn], error: null });
    mocks.deleteMaybe.mockReturnValue({ error: null });
    mocks.from.mockImplementation((table: string) => chain(table === "transactions" ? mocks.txnMaybe : mocks.deleteMaybe));
    mocks.createClient.mockResolvedValue({ from: mocks.from });
  });

  it.each(["GET", "DELETE"])("1/4. %s requires authentication", async (method) => {
    mocks.getUser.mockResolvedValue(null);
    const route = await import("./route");
    expect((await route[method as "GET"](req(method), ctx)).status).toBe(401);
  });

  it.each(["GET", "DELETE"])("2-5. %s returns the same 404 for absent or foreign uploads", async (method) => {
    const route = await import("./route");
    mocks.getUploadForUser.mockResolvedValueOnce(null);
    const absent = await route[method as "GET"](req(method), ctx);
    mocks.getUploadForUser.mockResolvedValueOnce(null);
    const foreign = await route[method as "GET"](req(method), ctx);
    expect(absent.status).toBe(404); expect(foreign.status).toBe(404);
    expect(await absent.text()).toBe(await foreign.text());
  });

  it("6-8/13. free response has no transactions or merchant, limits insights, and skips transaction query", async () => {
    const { GET } = await import("./route");
    const response = await GET(req(), ctx); const text = await response.text(); const json = JSON.parse(text);
    expect(json.report.transactions).toEqual([]); expect(text).not.toContain(MERCHANT);
    expect(json.report.summary.insights).toHaveLength(3); expect(json.report.lockedTxnCount).toBe(1);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("9. pro response includes all transactions and insights", async () => {
    mocks.getProfilePlan.mockResolvedValue("pro");
    const { GET } = await import("./route"); const json = await (await GET(req(), ctx)).json();
    expect(json.report.transactions).toHaveLength(1); expect(json.report.summary.insights).toHaveLength(5);
  });

  it("10. ignores client-provided plan values", async () => {
    const { GET } = await import("./route");
    const json = await (await GET(req("GET", "?plan=pro"), ctx)).json();
    expect(json.report.transactions).toEqual([]); expect(mocks.getProfilePlan).toHaveBeenCalledWith(USER_ID);
  });

  it("11. processing response is lightweight", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ status: "processing", summary: null }));
    const { GET } = await import("./route"); const json = await (await GET(req(), ctx)).json();
    expect(json).toEqual({ id: UPLOAD_ID, status: "processing" });
    expect(mocks.getProfilePlan).not.toHaveBeenCalled(); expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("12. failed response returns only status and fixed error code", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ status: "failed", errorCode: "analysis_failed", summary: null }));
    const { GET } = await import("./route");
    expect(await (await GET(req(), ctx)).json()).toEqual({ id: UPLOAD_ID, status: "failed", error_code: "analysis_failed" });
  });

  it("14-15. expired upload keeps its report and disables retry", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ storagePath: null, expiresAt: "2020-01-01T00:00:00.000Z" }));
    const { GET } = await import("./route"); const json = await (await GET(req(), ctx)).json();
    expect(json.report.summary.expenseTotal).toBe(1000); expect(json.canRetry).toBe(false);
  });

  it("16/19/21. deletes Storage before the user-scoped DB row and never deletes transactions explicitly", async () => {
    const order: string[] = [];
    mocks.deleteOriginalForUser.mockImplementation(async () => { order.push("storage"); });
    mocks.deleteMaybe.mockImplementation(() => { order.push("db"); return { error: null }; });
    const { DELETE } = await import("./route"); expect((await DELETE(req("DELETE"), ctx)).status).toBe(204);
    expect(order).toEqual(["storage", "db"]); expect(mocks.deleteOriginalForUser).toHaveBeenCalledWith(USER_ID, `${USER_ID}/${UPLOAD_ID}.csv`);
    expect(mocks.from).toHaveBeenCalledWith("uploads"); expect(mocks.from).not.toHaveBeenCalledWith("transactions");
  });

  it("17. does not delete the DB row when Storage deletion fails", async () => {
    mocks.deleteOriginalForUser.mockRejectedValue(new Error("secret storage detail"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { DELETE } = await import("./route"); expect((await DELETE(req("DELETE"), ctx)).status).toBe(500);
    expect(mocks.from).not.toHaveBeenCalled(); spy.mockRestore();
  });

  it("18/20. skips Storage for an expired original and deletes only the DB row", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({ storagePath: null }));
    const { DELETE } = await import("./route"); expect((await DELETE(req("DELETE"), ctx)).status).toBe(204);
    expect(mocks.deleteOriginalForUser).not.toHaveBeenCalled(); expect(mocks.from).toHaveBeenCalledWith("uploads");
  });

  it("23. keeps the completed response contract while adding recompute fields", async () => {
    const { GET } = await import("./route");
    const json = await (await GET(req(), ctx)).json();
    expect(Object.keys(json).sort()).toEqual(
      ["canRetry", "id", "recomputed_at", "recomputing", "report", "status"],
    );
    expect(json.recomputing).toBe(false);
    expect(json.recomputed_at).toBeNull();
  });

  it("24. reports an in-flight recompute and the last recompute time", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({
      recomputeStartedAt: new Date(Date.now() - 60_000).toISOString(),
      recomputedAt: "2026-02-01T00:00:00.000Z",
    }));
    const { GET } = await import("./route");
    const json = await (await GET(req(), ctx)).json();
    expect(json.recomputing).toBe(true);
    expect(json.recomputed_at).toBe("2026-02-01T00:00:00.000Z");
    expect(json.status).toBe("completed");
    expect(json.report.summary.expenseTotal).toBe(1000);
  });

  // 잠금이 15분을 넘기면 새 재계산을 걸 수 있다. 그때까지 '재계산 중'이라고
  // 답하면 화면은 영원히 돌아오지 않는 결과를 기다린다.
  it("25. does not report a stale recompute lock as running", async () => {
    mocks.getUploadForUser.mockResolvedValue(upload({
      recomputeStartedAt: "2020-01-01T00:00:00.000Z",
    }));
    const { GET } = await import("./route");
    expect((await (await GET(req(), ctx)).json()).recomputing).toBe(false);
  });

  it("22. logs metadata only, without filename or merchant", async () => {
    mocks.getProfilePlan.mockRejectedValue(new Error(`${MERCHANT} private.csv`));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("./route"); await GET(req(), ctx);
    const logged = JSON.stringify(spy.mock.calls); expect(logged).not.toContain(MERCHANT); expect(logged).not.toContain("private.csv");
    spy.mockRestore();
  });
});
