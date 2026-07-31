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
