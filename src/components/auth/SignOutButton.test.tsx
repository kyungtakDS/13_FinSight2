import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signOut, createClient, push, refresh } = vi.hoisted(() => ({
  signOut: vi.fn(),
  createClient: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { SignOutButton } from "./SignOutButton";

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({ auth: { signOut } });
    signOut.mockResolvedValue({ error: null });
  });

  afterEach(cleanup);

  it("signs out and returns to the landing page", async () => {
    render(<SignOutButton />);

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));

    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("has an accessible text label", () => {
    render(<SignOutButton />);

    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });
});
