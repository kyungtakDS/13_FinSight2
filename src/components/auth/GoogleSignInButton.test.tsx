import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithOAuth, createClient } = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient }));

import { GoogleSignInButton } from "./GoogleSignInButton";

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClient.mockReturnValue({ auth: { signInWithOAuth } });
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  afterEach(cleanup);

  it("starts Google OAuth with the fixed callback URL", async () => {
    render(<GoogleSignInButton />);

    fireEvent.click(screen.getByRole("button", { name: /google/i }));

    await waitFor(() =>
      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      }),
    );
  });

  it("has an accessible name and disables itself while starting OAuth", async () => {
    let resolveSignIn!: (value: { error: null }) => void;
    signInWithOAuth.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));
    render(<GoogleSignInButton />);
    const button = screen.getByRole("button", { name: /google/i });

    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    resolveSignIn({ error: null });
  });
});
