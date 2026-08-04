import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieGetAll: vi.fn(() => [{ name: "session", value: "cookie-value" }]),
  cookieSet: vi.fn(),
  cookies: vi.fn(),
  createServerClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

describe("server Supabase client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mocks.cookies.mockResolvedValue({
      getAll: mocks.cookieGetAll,
      set: mocks.cookieSet,
    });
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("passes a read/write cookie adapter to createServerClient", async () => {
    const { createClient } = await import("./server");
    await createClient();

    expect(mocks.createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: {
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        },
      }),
    );

    const options = mocks.createServerClient.mock.calls[0]?.[2];
    expect(options.cookies.getAll()).toEqual([
      { name: "session", value: "cookie-value" },
    ]);
    options.cookies.setAll([{ name: "new", value: "value", options: {} }]);
    expect(mocks.cookieSet).toHaveBeenCalledWith("new", "value", {});
  });

  it("returns the authenticated user and null when absent", async () => {
    const user = { id: "user-1" };
    mocks.getUser
      .mockResolvedValueOnce({ data: { user }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    const { getUser } = await import("./server");

    await expect(getUser()).resolves.toEqual(user);
    await expect(getUser()).resolves.toBeNull();
  });

  // 세션이 없는 것은 오류가 아니라 "아직 로그인하지 않았다"는 정상 상태다.
  // 이걸 throw 하면 라우트의 `if (!user) return 401` 에 도달하지 못하고
  // 바깥 catch 가 500 으로 바꿔, 미인증 요청이 서버 장애로 보고된다.
  it("treats a missing session as unauthenticated, not an error", async () => {
    const sessionMissing = Object.assign(new Error("Auth session missing!"), {
      name: "AuthSessionMissingError",
      status: 400,
      code: "session_missing",
      __isAuthError: true,
    });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: sessionMissing });
    const { getUser } = await import("./server");

    await expect(getUser()).resolves.toBeNull();
  });

  it("treats a session_missing code as unauthenticated even without the class name", async () => {
    const sessionMissing = Object.assign(new Error("Auth session missing!"), {
      code: "session_missing",
      __isAuthError: true,
    });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: sessionMissing });
    const { getUser } = await import("./server");

    await expect(getUser()).resolves.toBeNull();
  });

  it.each([
    ["network failure", Object.assign(new Error("fetch failed"), { name: "TypeError" })],
    [
      "invalid token",
      Object.assign(new Error("invalid JWT"), {
        name: "AuthApiError",
        status: 401,
        code: "bad_jwt",
        __isAuthError: true,
      }),
    ],
    [
      "upstream outage",
      Object.assign(new Error("service unavailable"), {
        name: "AuthRetryableFetchError",
        status: 503,
        __isAuthError: true,
      }),
    ],
  ])("rethrows a real failure: %s", async (_label, error) => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error });
    const { getUser } = await import("./server");

    await expect(getUser()).rejects.toBe(error);
  });

  it("validates anon environment variables lazily", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serverModule = await import("./server");

    await expect(serverModule.createClient()).rejects.toThrow(
      "missing env: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
