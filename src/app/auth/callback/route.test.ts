import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { exchangeCodeForSession, createClient } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { GET } from "./route";

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    createClient.mockResolvedValue({
      auth: { exchangeCodeForSession },
    });
  });

  it("exchanges a code and redirects to the dashboard", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(new NextRequest("https://finsight.test/auth/callback?code=oauth-code"));

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(response.headers.get("location")).toBe("https://finsight.test/dashboard");
  });

  it("redirects to the landing page when the code is absent", async () => {
    const response = await GET(new NextRequest("https://finsight.test/auth/callback"));

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://finsight.test/");
  });

  it("redirects without exposing the original exchange error", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("sensitive failure") });

    const response = await GET(new NextRequest("https://finsight.test/auth/callback?code=bad"));

    expect(response.headers.get("location")).toBe("https://finsight.test/");
    expect(response.headers.get("location")).not.toContain("sensitive");
  });

  it("ignores user-controlled redirect parameters", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      new NextRequest("https://finsight.test/auth/callback?code=ok&next=https://evil.test"),
    );

    expect(response.headers.get("location")).toBe("https://finsight.test/dashboard");
  });
});
