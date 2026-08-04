import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

vi.mock("@/components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button type="button">Google로 시작하기</button>,
}));

describe("Hero", () => {
  afterEach(cleanup);

  it("orders eyebrow, sentence-case headline, body, two CTAs, then caption", () => {
    const { container } = render(<Hero />);
    const hero = container.querySelector('[data-testid="landing-hero"]');
    expect(hero?.children).toHaveLength(5);
    expect(hero?.children[0]).toHaveClass("t-eyebrow");
    expect(hero?.children[1]).toHaveClass("t-display-xl");
    expect(hero?.children[2]).toHaveClass("t-body-lg");
    expect(hero?.children[4]).toHaveClass("t-caption");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "카드 명세서를 올리면, 경비 후보가 정리됩니다",
    );
    expect(screen.getByRole("button", { name: "Google로 시작하기" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "작동 방식 보기" })).toHaveAttribute("href", "#how");
  });

  it("uses cautious positioning and includes the tax-advice constraint", () => {
    render(<Hero />);
    expect(screen.getByText(/세무 자문이 아닙니다/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("환급받으세요");
    expect(document.body.textContent).not.toContain("경비 처리하세요");
  });
});
