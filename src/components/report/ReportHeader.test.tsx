import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportHeader } from "./ReportHeader";

describe("ReportHeader", () => {
  afterEach(cleanup);
  it("renders the single-file warning, period, and numeric transaction count from props", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ReportHeader periodStart="2026-01-01" periodEnd="2026-01-31" txnCount={1234} />);
    expect(screen.getByRole("heading", { name: /파일 1개 기준/ })).toBeInTheDocument();
    expect(screen.getByText(/2026-01-01.*2026-01-31/)).toBeInTheDocument();
    expect(screen.getByText("1,234건")).toHaveClass("num");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
