import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Steps } from "./Steps";

describe("Steps", () => {
  afterEach(cleanup);

  it("renders the real four-step flow in order", () => {
    const { container } = render(<Steps />);
    expect(container.querySelectorAll("article")).toHaveLength(4);
    expect(screen.getAllByTestId("step-number").map((node) => node.textContent)).toEqual([
      "01", "02", "03", "04",
    ]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      "Google 가입", "CSV 업로드", "자동 분석", "리포트 확인",
    ]);
  });

  it("uses mono eyebrow styling and the allowed accent exception for numbers", () => {
    render(<Steps />);
    for (const number of screen.getAllByTestId("step-number")) {
      expect(number).toHaveClass("t-eyebrow");
      expect(number).toHaveStyle({ color: "var(--fs-accent)" });
    }
  });
});
