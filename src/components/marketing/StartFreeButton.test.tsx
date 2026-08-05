import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, getSession, signInWithOAuth } = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient }));

import { StartFreeButton } from "./StartFreeButton";

describe("StartFreeButton", () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    assign = vi.fn();
    vi.stubGlobal("location", { origin: "http://localhost:3000", assign });
    createClient.mockReturnValue({ auth: { getSession, signInWithOAuth } });
    getSession.mockResolvedValue({ data: { session: null } });
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts Google OAuth for a signed-out visitor", async () => {
    render(<StartFreeButton />);

    fireEvent.click(screen.getByRole("button", { name: "무료로 시작하기" }));

    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
      }),
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a signed-in user to the dashboard", async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    render(<StartFreeButton />);

    fireEvent.click(screen.getByRole("button", { name: "무료로 시작하기" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("is a real button, never an in-page anchor", () => {
    // 회귀 방지: 이 CTA 가 href 를 가지면 클릭이 로그인 대신 페이지 내 스크롤로 끝난다.
    render(<StartFreeButton />);

    const cta = screen.getByRole("button", { name: "무료로 시작하기" });
    expect(cta).not.toHaveAttribute("href");
    expect(screen.queryByRole("link", { name: "무료로 시작하기" })).not.toBeInTheDocument();
  });

  it("explains the failure and stays clickable when OAuth fails", async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: "invalid_client secret leaked" } });
    render(<StartFreeButton />);
    const cta = screen.getByRole("button", { name: "무료로 시작하기" });

    fireEvent.click(cta);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("로그인을 시작하지 못했습니다");
    // 상류 예외 메시지를 사용자에게 그대로 노출하지 않는다.
    expect(alert).not.toHaveTextContent("invalid_client");
    await waitFor(() => expect(cta).not.toBeDisabled());
  });
});
