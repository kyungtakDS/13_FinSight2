import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getSession, signInWithOAuth } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient }));

import { useStartAction } from "./useStartAction";

describe("useStartAction", () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    assign = vi.fn();
    // jsdom 의 location 은 non-configurable 이라 spyOn 이 통하지 않는다.
    vi.stubGlobal("location", { origin: "http://localhost:3000", assign });
    createClient.mockReturnValue({ auth: { getSession, signInWithOAuth } });
    getSession.mockResolvedValue({ data: { session: null } });
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("starts Google OAuth when the visitor has no session", async () => {
    const { result } = renderHook(() => useStartAction());

    await act(async () => {
      await result.current.start();
    });

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback" },
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it("goes to the dashboard when a session already exists", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const { result } = renderHook(() => useStartAction());

    await act(async () => {
      await result.current.start();
    });

    expect(assign).toHaveBeenCalledWith("/dashboard");
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("keeps the action pending while the dashboard navigation is in flight", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    const { result } = renderHook(() => useStartAction());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.hasFailed).toBe(false);
  });

  it("reports failure and re-enables the action when OAuth fails", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "oauth provider exploded" } });
    const { result } = renderHook(() => useStartAction());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.hasFailed).toBe(true);
    expect(result.current.isPending).toBe(false);
  });

  it("reports failure when the Supabase client cannot be built", async () => {
    // createClient 는 NEXT_PUBLIC_* 가 없으면 throw 한다. 그 예외가 그대로 터지면
    // 버튼이 pending 에 갇혀 아무 설명 없이 죽는다.
    createClient.mockImplementation(() => {
      throw new Error("missing env: NEXT_PUBLIC_SUPABASE_URL");
    });
    const { result } = renderHook(() => useStartAction());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.hasFailed).toBe(true);
    expect(result.current.isPending).toBe(false);
  });
});
