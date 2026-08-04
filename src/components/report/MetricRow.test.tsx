import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MetricRow } from "./MetricRow";

describe("MetricRow", () => {
  afterEach(cleanup);
  it("renders exactly three fixed-color verdict metrics with numeric amounts", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<MetricRow expenseTotal={10000} personalTotal={2000} uncertainTotal={300} />);
    expect(container.querySelectorAll(".fs-card")).toHaveLength(3);
    for (const label of ["경비 후보", "개인 지출", "애매"]) expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.querySelectorAll(".fs-metric.num")).toHaveLength(3);
    expect(screen.getByText("경비 후보").parentElement).toHaveStyle({ color: "var(--fs-biz)" });
    expect(screen.getByText("개인 지출").parentElement).toHaveStyle({ color: "var(--fs-personal)" });
    expect(screen.getByText("애매").parentElement).toHaveStyle({ color: "var(--fs-unsure)" });
    expect(container.innerHTML).not.toContain("--color-error");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
