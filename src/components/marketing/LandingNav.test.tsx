import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingNav } from "./LandingNav";

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="테마 전환" type="button" />,
}));
vi.mock("@/components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button type="button">로그인</button>,
}));

describe("LandingNav", () => {
  afterEach(cleanup);

  it("renders the wordmark with the sole brand accent exception", () => {
    const { container } = render(<LandingNav />);
    expect(screen.getByText("FinSight")).toBeInTheDocument();
    expect(container.querySelector('[data-brand-dot="true"]')).toHaveStyle({
      background: "var(--fs-accent)",
    });
  });

  it("contains three valid links, theme control, login, and start action", () => {
    render(<LandingNav />);
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["#start", "#how", "#pricing", "#data", "#start"]);
    expect(screen.getByRole("button", { name: "테마 전환" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "무료로 시작하기" })).toBeInTheDocument();
  });

  it("constrains the login button so the nav stays on one row", () => {
    render(<LandingNav />);
    // .fs-google is an app-layer class with width: 100%; unconstrained it fills
    // the nav row and forces the header to wrap onto three lines.
    expect(screen.getByRole("button", { name: "로그인" }).parentElement).toHaveStyle({
      width: "max-content",
    });
  });
});
