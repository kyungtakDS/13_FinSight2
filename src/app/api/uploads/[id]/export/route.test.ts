import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  getUploadForUser: vi.fn(),
  getProfilePlan: vi.fn(),
  from: vi.fn(),
  transactionResult: vi.fn(),
  dictionaryResult: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.getUser,
  createClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/service", () => ({
  getUploadForUser: mocks.getUploadForUser,
  getProfilePlan: mocks.getProfilePlan,
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UPLOAD_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "SECRET,MERCHANT";

function upload(overrides: Record<string, unknown> = {}) {
  return {
    id: UPLOAD_ID, userId: USER_ID, storagePath: `${USER_ID}/${UPLOAD_ID}.csv`, filename: "private.csv",
    fileHash: "hash", status: "completed", errorCode: null, retryCount: 0,
    periodStart: "2026-01-01", periodEnd: "2026-01-31", rowCount: 4, summary: {},
    expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:00.000Z", finishedAt: "2026-01-01T00:01:00.000Z", ...overrides,
  };
}

function chain(result: () => unknown) {
  const value: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "in"]) value[method] = vi.fn(() => value);
  value.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return value;
}

const transactions = [
  { row_index: 1, txn_date: "2026-01-02", merchant: SECRET, amount: 12000, account_code: "welfare", verdict: "expense" },
  { row_index: 2, txn_date: "2026-01-03", merchant: "A\"B", amount: 5000, account_code: "etc", verdict: "personal" },
  { row_index: 3, txn_date: "2026-01-04", merchant: "=cmd|' /C calc'!A0", amount: 3000, account_code: null, verdict: "uncertain" },
  { row_index: 4, txn_date: "2026-01-05", merchant: "환불", amount: -8900, account_code: "welfare", verdict: "expense" },
];
const ctx = { params: Promise.resolve({ id: UPLOAD_ID }) };
const req = (suffix = "") => new Request(`http://localhost/api/uploads/${UPLOAD_ID}/export${suffix}`);

describe("GET /api/uploads/[id]/export", () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.getUploadForUser.mockResolvedValue(upload());
    mocks.getProfilePlan.mockResolvedValue("pro");
    mocks.transactionResult.mockReturnValue({ data: transactions, error: null });
    mocks.dictionaryResult.mockReturnValue({ data: [{ merchant_key: SECRET, reason: "업무 식사" }], error: null });
    mocks.from.mockImplementation((table: string) => chain(table === "transactions" ? mocks.transactionResult : mocks.dictionaryResult));
    mocks.createClient.mockResolvedValue({ from: mocks.from });
  });

  it("1-5. gates free users before transaction lookup or CSV generation and ignores query plan", async () => {
    mocks.getProfilePlan.mockResolvedValue("free");
    const route = await import("./route");
    const csvSpy = vi.spyOn(route.csvGenerator, "create");
    const response = await route.GET(req("?plan=pro"), ctx);
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "payment_required" });
    expect(mocks.getProfilePlan).toHaveBeenCalledWith(USER_ID);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(csvSpy).not.toHaveBeenCalled();
  });

  it("6. requires a session", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { GET } = await import("./route");
    expect((await GET(req(), ctx)).status).toBe(401);
  });

  it.each(["absent", "foreign"])("7-9. returns 404 for %s before checking plan", async () => {
    mocks.getUploadForUser.mockResolvedValue(null);
    const { GET } = await import("./route");
    expect((await GET(req(), ctx)).status).toBe(404);
    expect(mocks.getProfilePlan).not.toHaveBeenCalled();
  });

  it.each(["processing", "failed"])("10. rejects %s uploads", async (status) => {
    mocks.getUploadForUser.mockResolvedValue(upload({ status }));
    const { GET } = await import("./route");
    expect((await GET(req(), ctx)).status).toBe(409);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("11-21. emits a BOM CSV with localized labels, escaping, reasons, uncertain rows, negatives, and disclaimer", async () => {
    const { GET } = await import("./route");
    const response = await GET(req(), ctx); const bytes = new Uint8Array(await response.arrayBuffer());
    const csv = new TextDecoder().decode(bytes.slice(3));
    expect(response.status).toBe(200);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv).toContain("거래일자,가맹점명,금액,계정과목,판정,근거");
    expect(csv).toContain("복리후생비"); expect(csv).not.toContain(",welfare,");
    expect(csv).toContain("사업 경비"); expect(csv).toContain("개인 지출"); expect(csv).toContain("애매");
    expect(csv).toContain(",-8900,");
    expect(csv).not.toContain("'-8900");
    expect(csv).toContain(`"${SECRET}"`); expect(csv).toContain('"A""B"');
    expect(csv).toContain("'=cmd|' /C calc'!A0");
    expect(csv).toContain("업무 식사");
    expect(csv).toContain("2026-01-04");
    expect(csv).toContain("본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오.");
    expect(mocks.from).toHaveBeenCalledWith("merchant_dictionary");
  });

  it("18. neutralizes every spreadsheet formula prefix", async () => {
    mocks.transactionResult.mockReturnValue({ data: ["=x", "+x", "-x", "@x", "\tx", "\rx"].map((merchant, row_index) => ({
      row_index, txn_date: "2026-01-01", merchant, amount: 1, account_code: null, verdict: "uncertain",
    })), error: null });
    const { GET } = await import("./route"); const csv = await (await GET(req(), ctx)).text();
    for (const prefix of ["'=x", "'+x", "'-x", "'@x", "'\tx", "'\rx"]) expect(csv).toContain(prefix);
  });

  // 취소전표매입이 음수로 들어오면서 생긴 회귀 — 수식 방어가 숫자까지 텍스트로 만들면
  // 세무사가 받는 파일에서 금액 열의 합계가 잡히지 않는다.
  it("21b. keeps negative amounts numeric while still escaping negative-looking text", async () => {
    mocks.transactionResult.mockReturnValue({ data: [
      { row_index: 1, txn_date: "2026-01-05", merchant: "-가맹점", amount: -149900, account_code: "vehicle", verdict: "expense" },
    ], error: null });
    const { GET } = await import("./route"); const csv = await (await GET(req(), ctx)).text();
    expect(csv).toContain(",-149900,");
    expect(csv).toContain("'-가맹점");
  });

  it("22-24. sets CSV download headers using only server-generated filename parts", async () => {
    const { GET } = await import("./route"); const response = await GET(req(), ctx);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="finsight_${UPLOAD_ID}_2026-01-01_2026-01-31.csv"`,
    );
    expect(response.headers.get("content-disposition")).not.toContain("private.csv");
  });

  it("25. logs metadata only", async () => {
    mocks.transactionResult.mockReturnValue({ data: null, error: new Error(`${SECRET},raw csv`) });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { GET } = await import("./route"); expect((await GET(req(), ctx)).status).toBe(500);
    const logged = JSON.stringify(spy.mock.calls);
    expect(logged).not.toContain(SECRET); expect(logged).not.toContain("raw csv"); expect(logged).not.toContain("private.csv");
    spy.mockRestore();
  });
});
