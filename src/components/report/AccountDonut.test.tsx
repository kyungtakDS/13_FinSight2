import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AccountCode } from "@/types/account-codes";
import type { AccountBreakdown } from "@/types/report";
import { AccountDonut } from "./AccountDonut";

const codes: AccountCode[] = ["books", "supplies", "travel", "comms", "fees", "ads", "rent"];
const account = (label: string, total: number, ratio: number, index = 0): AccountBreakdown => ({ code: codes[index]!, label, total, ratio, count: 2 });
const accounts = Array.from({ length: 7 }, (_, i) => account(`과목 ${i + 1}`, 7000 - i * 1000, (7 - i) / 28, i));

describe("AccountDonut", () => {
  afterEach(cleanup);
  it("renders an accessible responsive SVG donut with ranked cycling token colors", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<AccountDonut accounts={accounts} txnCount={14} />);
    expect(screen.getByRole("img", { name: /계정과목별 경비 후보 구성/ })).toBeInTheDocument();
    const segments = container.querySelectorAll("circle[data-segment]");
    expect(segments).toHaveLength(7);
    expect(segments[0]).toHaveAttribute("stroke", "var(--fs-chart-1)");
    expect(segments[6]).toHaveAttribute("stroke", "var(--fs-chart-1)");
    expect(container.querySelector("svg")).toHaveAttribute("width", "100%");
    expect(container.querySelectorAll(".fs-legend-row > .num:last-child")).toHaveLength(7);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("uses a real table for three transactions or fewer", () => {
    render(<AccountDonut accounts={accounts.slice(0, 2)} txnCount={3} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  it("does not draw empty data or an uncertain segment", () => {
    const { container, rerender } = render(<AccountDonut accounts={[]} txnCount={10} />);
    expect(container).toBeEmptyDOMElement();
    const mixed = [...accounts.slice(0, 2), { ...account("애매", 100, 0.1), verdict: "uncertain" as const }];
    rerender(<AccountDonut accounts={mixed} txnCount={10} />);
    expect(screen.queryByText("애매")).not.toBeInTheDocument();
    expect(container.querySelectorAll("circle[data-segment]")).toHaveLength(2);
  });
});
