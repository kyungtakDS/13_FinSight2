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

  it("names the anon key when only that one is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const clientModule = await import("./client");

    expect(() => clientModule.createClient()).toThrow(
      "missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    expect(createBrowserClient).not.toHaveBeenCalled();
  });

  it("reads NEXT_PUBLIC_* statically so Next can inline them into the browser bundle", async () => {
    const source = await readFile(
      join(process.cwd(), "src/lib/supabase/client.ts"),
      "utf8",
    );

    // Next는 `process.env.NEXT_PUBLIC_FOO` 리터럴만 빌드 시점에 정적으로 치환한다.
    // process.env[name] 같은 계산된 접근은 치환 대상이 아니라 브라우저 번들에서
    // 값이 설정돼 있어도 항상 undefined가 되고, 로그인 버튼이 missing env로 죽는다.
    // 이 테스트는 런타임이 아니라 소스 형태를 고정한다 — vitest는 치환을 하지 않으므로
    // 동적 접근이어도 런타임 테스트는 통과해 버리기 때문이다.
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(source).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(source).not.toMatch(/process\.env\s*\[/);
  });
});
