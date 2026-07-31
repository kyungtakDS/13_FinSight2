import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ kind: "browser" })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

describe("browser Supabase client", () => {
  beforeEach(() => {
    vi.resetModules();
    createBrowserClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("uses only the public URL and anon key", async () => {
    const { createClient } = await import("./client");

    expect(createClient()).toEqual({ kind: "browser" });
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
    );
  });

  it("never references the service role key in the client source", async () => {
    const source = await readFile(
      join(process.cwd(), "src/lib/supabase/client.ts"),
      "utf8",
    );

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("validates environment variables lazily", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const clientModule = await import("./client");

    expect(() => clientModule.createClient()).toThrow(
      "missing env: NEXT_PUBLIC_SUPABASE_URL",
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
