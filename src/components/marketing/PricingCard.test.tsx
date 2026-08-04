import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PricingCard } from "./PricingCard";

describe("PricingCard", () => {
  afterEach(cleanup);

  it("renders features, price numerals, featured treatment, and CTA variant", () => {
    const onCta = vi.fn();
    render(<PricingCard name="Pro" price="₩9,900" period="월" blurb="전체 기능" features={["전체 내역", "다운로드"]} ctaLabel="시작" ctaVariant="secondary" featured onCta={onCta} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("₩9,900")).toHaveClass("num");
    expect(screen.getByRole("article")).toHaveClass("marketing-pricing-card--featured");
    expect(screen.getByRole("button", { name: "시작" })).toHaveClass("marketing-button--secondary");
    fireEvent.click(screen.getByRole("button", { name: "시작" }));
    expect(onCta).toHaveBeenCalledOnce();
  });
});
