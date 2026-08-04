import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SavingsHero } from "./SavingsHero";

describe("SavingsHero", () => {
  afterEach(cleanup);
  it("shows a conservative formatted estimate without directive tax language", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<SavingsHero estimatedSaving={1234567} taxRate={0.066} />);
    const metric = container.querySelector(".fs-metric-big.num");
    expect(metric).toHaveTextContent("₩1,234,567");
    expect(metric?.querySelector("span")).toHaveAttribute("style", expect.stringContaining("font-size: 0.6em"));
    expect(screen.getByText("예상 절감액(참고용)")).toBeInTheDocument();
    expect(screen.getByText(/6.6%.*최저 세율 기준 보수적 추정/)).toBeInTheDocument();
    const directivePhrases = ["환급", "경비 처리", "신고"].map((phrase) => `${phrase}하세요`);
    for (const phrase of directivePhrases) expect(container.textContent).not.toContain(phrase);
    expect(container.firstElementChild).toHaveAttribute("style", expect.stringMatching(/background: var\(--fs-accent-soft\).*border-color: var\(--fs-accent-line\)/));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
