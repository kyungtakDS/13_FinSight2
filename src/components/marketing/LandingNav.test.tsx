import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingNav } from "./LandingNav";

vi.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button aria-label="테마 전환" type="button" />,
}));
vi.mock("@/components/auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <button type="button">로그인</button>,
}));
vi.mock("./StartFreeButton", () => ({
  StartFreeButton: () => <button type="button">무료로 시작하기</button>,
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
    // 브랜드 워드마크 + 섹션 링크 3개. 시작 CTA 는 링크가 아니라 버튼이다.
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["#start", "#how", "#pricing", "#data"]);
    expect(screen.getByRole("button", { name: "테마 전환" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "무료로 시작하기" })).toBeInTheDocument();
  });

  it("does not route the start CTA to an in-page anchor", () => {
    // 회귀 방지: 이 CTA 가 링크였을 때 클릭이 로그인 대신 해시 이동으로 끝났다.
    render(<LandingNav />);
    expect(screen.queryByRole("link", { name: "무료로 시작하기" })).not.toBeInTheDocument();
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
