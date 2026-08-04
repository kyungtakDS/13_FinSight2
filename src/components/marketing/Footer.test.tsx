import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Footer } from "./Footer";

describe("Footer", () => {
  afterEach(cleanup);

  it("renders mono column headings and real anchors", () => {
    render(<Footer brand="FinSight" columns={[{ head: "제품", links: [{ label: "기능", href: "/#features" }] }]} />);
    expect(screen.getByText("제품")).toHaveClass("t-caption");
    expect(screen.getByRole("link", { name: "기능" })).toHaveAttribute("href", "/#features");
  });
});
