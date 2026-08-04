import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  afterEach(cleanup);

  it("explains the next action and upload constraints without an empty chart", () => {
    const { container } = render(<EmptyState />);
    expect(screen.getByText(/카드 명세서 CSV를 올려/)).toBeInTheDocument();
    expect(screen.getByText(/카드사별 CSV 내려받는 법/)).toBeInTheDocument();
    expect(screen.getByText(/CSV 전용.*2MB.*3,000행/)).toBeInTheDocument();
    expect(container.querySelector("canvas, svg, [role='img']")).toBeNull();
  });
});
