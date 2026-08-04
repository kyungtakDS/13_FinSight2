import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => (
    <button aria-label="테마 전환" type="button">
      <svg aria-hidden="true" />
    </button>
  ),
}));
vi.mock("@/components/auth/SignOutButton", () => ({
  SignOutButton: () => <button type="button">로그아웃</button>,
}));

import { Topbar } from "./Topbar";

describe("Topbar", () => {
  afterEach(cleanup);

  it("renders its title and controls", () => {
    render(<Topbar title="대시보드" />);

    expect(screen.getByRole("heading", { name: "대시보드" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "테마 전환" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("gives every icon-only button an accessible label", () => {
    const { container } = render(<Topbar title="대시보드" />);
    const iconButtons = [...container.querySelectorAll("button")].filter(
      (button) => button.querySelector("svg") && !button.textContent?.trim(),
    );

    expect(iconButtons.length).toBeGreaterThan(0);
    for (const button of iconButtons) {
      expect(button).toHaveAttribute("aria-label");
    }
  });
});
