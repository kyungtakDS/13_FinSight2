import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, createServerClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { config, middleware } from "./middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    createServerClient.mockImplementation(
      (_url: string, _key: string, options: { cookies: { setAll: (cookies: Array<{ name: string; value: string }>) => void } }) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll([{ name: "session", value: "refreshed" }]);
            return getUser();
          },
        },
      }),
    );
  });

  it.each(["/dashboard", "/dashboard/uploads/abc"])(
    "redirects an unauthenticated request for %s to the landing page",
    async (pathname) => {
      getUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await middleware(new NextRequest(`https://finsight.test${pathname}`));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("https://finsight.test/");
    },
  );

  it("allows an authenticated dashboard request", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await middleware(new NextRequest("https://finsight.test/dashboard"));

    expect(response.headers.get("location")).toBeNull();
  });

  it.each(["/", "/legal", "/auth/callback"])(
    "allows unauthenticated access to %s",
    async (pathname) => {
      getUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await middleware(new NextRequest(`https://finsight.test${pathname}`));

      expect(response.headers.get("location")).toBeNull();
    },
  );

  it("excludes static assets from the matcher", () => {
    const matcher = config.matcher[0];

    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("_next/image");
    expect(matcher).toContain("favicon.ico");
    expect(matcher).toContain("svg|png|jpg|jpeg|gif|webp");
  });

  it("returns cookies refreshed by the Supabase adapter", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await middleware(new NextRequest("https://finsight.test/dashboard"));

    expect(response.cookies.get("session")?.value).toBe("refreshed");
  });
});
