import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProcessingPanel } from "./ProcessingPanel";

describe("ProcessingPanel", () => {
  afterEach(cleanup);

  it("describes every possible step without inventing determinate progress", () => {
    const { container } = render(<ProcessingPanel />);

    expect(container.textContent).not.toContain("%");
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(container.querySelectorAll(".fs-step")).toHaveLength(4);
    for (const label of ["파일 읽는 중", "양식 판별", "거래 분류", "결과 집계"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/탭을 닫아도 분석은 서버에서 계속됩니다/)).toBeInTheDocument();
  });

  it("does not use timers to advance a fabricated current step", () => {
    const timerSpy = vi.spyOn(globalThis, "setInterval");
    render(<ProcessingPanel />);
    expect(timerSpy).not.toHaveBeenCalled();
    expect(screen.getAllByText(/· 진행 중/)).toHaveLength(4);
    timerSpy.mockRestore();
  });
});
