import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  fileHash: vi.fn(),
  storagePathFor: vi.fn(),
  runAnalysis: vi.fn(),
  after: vi.fn(),
  from: vi.fn(),
  duplicateMaybeSingle: vi.fn(),
  insertSingle: vi.fn(),
  listLimit: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getUser: mocks.getUser,
  createClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/service", () => ({ storagePathFor: mocks.storagePathFor }));
vi.mock("@/lib/csv/fingerprint", () => ({ fileHash: mocks.fileHash }));
vi.mock("@/lib/analysis/run-analysis", () => ({ runAnalysis: mocks.runAnalysis }));
vi.mock("next/server", () => ({ after: mocks.after }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const UPLOAD_ID = "22222222-2222-4222-8222-222222222222";

function chain(terminal: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = { ...terminal };
  for (const method of ["select", "eq", "order"]) value[method] = vi.fn(() => value);
  value.maybeSingle = mocks.duplicateMaybeSingle;
  value.single = mocks.insertSingle;
  value.limit = mocks.listLimit;
  value.insert = vi.fn(() => value);
  return value;
}

function request(file?: File, contentType?: string): Request {
  if (contentType) {
    return new Request("http://localhost/api/uploads", {
      method: "POST",
      headers: { "content-type": contentType },
      body: contentType === "application/json" ? "{}" : undefined,
    });
  }
  const form = new FormData();
  if (file) form.set("file", file);
  return {
    headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
    formData: vi.fn().mockResolvedValue(form),
  } as unknown as Request;
}

function csv(name = "card.csv", body = "date,merchant,amount\n2026-01-01,shop,1000") {
  return new File([body], name, { type: "text/csv" });
}

async function body(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("/api/uploads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ id: USER_ID });
    mocks.fileHash.mockReturnValue("file-hash");
    mocks.storagePathFor.mockReturnValue(`${USER_ID}/${UPLOAD_ID}.csv`);
    mocks.duplicateMaybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.insertSingle.mockResolvedValue({ data: { id: UPLOAD_ID }, error: null });
    mocks.listLimit.mockResolvedValue({ data: [], error: null });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.remove.mockResolvedValue({ error: null });
    mocks.runAnalysis.mockResolvedValue(undefined);
    const duplicate = chain();
    const insert = chain();
    const list = chain();
    mocks.from.mockImplementation(() => {
      const call = mocks.from.mock.calls.length;
      return call === 1 ? duplicate : call === 2 ? insert : list;
    });
    mocks.createClient.mockResolvedValue({
      from: mocks.from,
      storage: { from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })) },
    });
  });

  it("1. rejects an unauthenticated request", async () => {
    mocks.getUser.mockResolvedValue(null);
    const { POST } = await import("./route");
    expect((await POST(request(csv()))).status).toBe(401);
  });

  it("2. rejects non-multipart input with parse_failed", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(undefined, "application/json"));
    expect([response.status, await body(response)]).toEqual([400, { error: "parse_failed" }]);
  });

  it("3. rejects non-csv extensions", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(csv("card.xlsx")));
    expect([response.status, await body(response)]).toEqual([400, { error: "parse_failed" }]);
  });

  it("4. rejects files larger than 2MB", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(csv("card.csv", "x".repeat(2 * 1024 * 1024 + 1))));
    expect([response.status, await body(response)]).toEqual([400, { error: "too_large" }]);
  });

  it("5. rejects empty files", async () => {
    const { POST } = await import("./route");
    const response = await POST(request(csv("card.csv", "")));
    expect([response.status, await body(response)]).toEqual([400, { error: "parse_failed" }]);
  });

  it("6. performs every input validation before touching Storage", async () => {
    const { POST } = await import("./route");
    await POST(request(csv("card.pdf")));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("7. returns the existing upload id for duplicates", async () => {
    mocks.duplicateMaybeSingle.mockResolvedValue({ data: { id: "existing-id" }, error: null });
    const { POST } = await import("./route");
    const response = await POST(request(csv()));
    expect([response.status, await body(response)]).toEqual([409, { error: "duplicate_file", existingUploadId: "existing-id" }]);
  });

  it("8. never uploads duplicate content to Storage", async () => {
    mocks.duplicateMaybeSingle.mockResolvedValue({ data: { id: "existing-id" }, error: null });
    const { POST } = await import("./route");
    await POST(request(csv()));
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("9. scopes the hash lookup to the authenticated user", async () => {
    const { POST } = await import("./route");
    await POST(request(csv()));
    const duplicate = mocks.from.mock.results[0]!.value;
    expect(duplicate.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(duplicate.eq).toHaveBeenCalledWith("file_hash", "file-hash");
  });

  it("10. removes the just-uploaded object when insert fails", async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: { code: "db" } });
    const { POST } = await import("./route");
    expect((await POST(request(csv()))).status).toBe(500);
    expect(mocks.remove).toHaveBeenCalledWith([`${USER_ID}/${UPLOAD_ID}.csv`]);
  });

  it("11. keeps compensation failure behind one fixed 500 response", async () => {
    mocks.insertSingle.mockResolvedValue({ data: null, error: { code: "db" } });
    mocks.remove.mockRejectedValue(new Error("storage secret"));
    const { POST } = await import("./route");
    const response = await POST(request(csv()));
    expect([response.status, await body(response)]).toEqual([500, { error: "upstream" }]);
  });

  it("12. does not return 202 unless upload and row insert both succeed", async () => {
    mocks.upload.mockResolvedValue({ error: { code: "storage" } });
    const { POST } = await import("./route");
    expect((await POST(request(csv()))).status).toBe(500);
    expect(mocks.insertSingle).not.toHaveBeenCalled();
  });

  it("13. schedules analysis through after after accepting", async () => {
    const { POST } = await import("./route");
    expect((await POST(request(csv()))).status).toBe(202);
    expect(mocks.after).toHaveBeenCalledOnce();
    const callback = mocks.after.mock.calls[0]![0];
    await callback();
    expect(mocks.runAnalysis).toHaveBeenCalledWith(USER_ID, UPLOAD_ID);
  });

  it("14. returns without awaiting the after callback", async () => {
    mocks.after.mockImplementation(() => undefined);
    mocks.runAnalysis.mockReturnValue(new Promise(() => undefined));
    const { POST } = await import("./route");
    await expect(POST(request(csv()))).resolves.toMatchObject({ status: 202 });
  });

  it("15. isolates a later analysis failure from the accepted response", async () => {
    mocks.runAnalysis.mockRejectedValue(new Error("later"));
    const { POST } = await import("./route");
    const response = await POST(request(csv()));
    expect(response.status).toBe(202);
  });

  it("16. stores at the user-scoped generated path", async () => {
    const { POST } = await import("./route");
    await POST(request(csv()));
    expect(mocks.storagePathFor).toHaveBeenCalledWith(USER_ID, expect.any(String));
    expect(mocks.upload).toHaveBeenCalledWith(`${USER_ID}/${UPLOAD_ID}.csv`, expect.any(Uint8Array), expect.any(Object));
  });

  it("17. never includes the supplied filename in the Storage path", async () => {
    const { POST } = await import("./route");
    await POST(request(csv("private-name.csv")));
    expect(mocks.upload.mock.calls[0]![0]).not.toContain("private-name");
  });

  it("18. inserts processing state, zero retries, and a 90-day expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-04T00:00:00.000Z"));
    const { POST } = await import("./route");
    await POST(request(csv()));
    const inserted = mocks.from.mock.results[1]!.value.insert.mock.calls[0]![0];
    expect(inserted).toMatchObject({ status: "processing", retry_count: 0, expires_at: "2026-11-02T00:00:00.000Z" });
    vi.useRealTimers();
  });

  it("19. stores the display filename", async () => {
    const { POST } = await import("./route");
    await POST(request(csv("display.csv")));
    const inserted = mocks.from.mock.results[1]!.value.insert.mock.calls[0]![0];
    expect(inserted.filename).toBe("display.csv");
  });

  it("20. scopes GET results to the authenticated user", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/uploads"));
    const query = mocks.from.mock.results[0]!.value;
    expect(query.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("21. orders GET results newest first", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/uploads"));
    const query = mocks.from.mock.results[0]!.value;
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("22. selects only list metadata, excluding summary and transactions", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/uploads"));
    const selection = mocks.from.mock.results[0]!.value.select.mock.calls[0]![0] as string;
    expect(selection).not.toContain("summary");
    expect(selection).not.toContain("transactions");
    expect(selection).toContain("row_count");
  });

  it("23. caps GET at 100 uploads", async () => {
    const { GET } = await import("./route");
    await GET(new Request("http://localhost/api/uploads"));
    expect(mocks.listLimit).toHaveBeenCalledWith(100);
  });

  it("24. never logs filenames or CSV contents", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.upload.mockResolvedValue({ error: { message: "secret" } });
    const { POST } = await import("./route");
    await POST(request(csv("PII-filename.csv", "UNIQUE-CSV-PII")));
    const logs = JSON.stringify(error.mock.calls);
    expect(logs).not.toContain("PII-filename");
    expect(logs).not.toContain("UNIQUE-CSV-PII");
    error.mockRestore();
  });
});
