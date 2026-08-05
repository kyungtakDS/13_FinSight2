import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./StartFreeButton", () => ({
  StartFreeButton: () => <button data-testid="start-free" type="button">무료로 시작하기</button>,
}));

import { Pricing } from "./Pricing";

describe("Pricing", () => {
  afterEach(cleanup);

  it("renders exactly the free and Pro tiers without tabs or usage limits", () => {
    const { container } = render(<Pricing />);
    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "무료", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pro", level: 3 })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/월 [0-9]+회|분석 [0-9]+회|횟수/);
    expect(container.querySelector('[role="tablist"]')).not.toBeInTheDocument();
  });

  it("matches the feature gate and displays the single-source monthly price", () => {
    render(<Pricing />);
    expect(screen.getByText("업로드·분석 무제한")).toBeInTheDocument();
    expect(screen.getByText("예상 절감액(참고용)")).toBeInTheDocument();
    expect(screen.getByText("상위 3개 인사이트")).toBeInTheDocument();
    expect(screen.getByText("거래별 전체 분류와 판정 근거")).toBeInTheDocument();
    expect(screen.getByText("세무사 전달용 파일 다운로드")).toBeInTheDocument();
    expect(screen.getByText("₩9,900")).toHaveClass("num");
    expect(screen.getByText("/ 월")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pro 시작하기" })).toBeInTheDocument();
    expect(readFileSync(resolve("src/components/marketing/Pricing.tsx"), "utf8")).toContain(
      'window.location.assign("/upgrade")',
    );
  });

  it("drives the free tier CTA through the shared start action, not an anchor scroll", () => {
    const source = readFileSync(resolve("src/components/marketing/Pricing.tsx"), "utf8");
    render(<Pricing />);
    expect(screen.getByTestId("start-free")).toBeInTheDocument();
    // 예전에는 이 CTA 가 히어로로 스크롤만 하고 로그인을 시작하지 않았다.
    expect(source).not.toContain("scrollIntoView");
    expect(source).not.toContain("#start");
  });

  it("states Polar management and post-cancellation retention", () => {
    render(<Pricing />);
    expect(screen.getByText(/결제·영수증·해지는 Polar 고객 포털에서 관리됩니다/)).toBeInTheDocument();
    expect(screen.getByText(/해지 후에도 데이터는 지우지 않습니다/)).toBeInTheDocument();
  });

  it("keeps the price constant in one source location", () => {
    const source = readFileSync(resolve("src/components/marketing/Pricing.tsx"), "utf8");
    expect(source.match(/₩9,900/g)).toHaveLength(1);
  });
});
