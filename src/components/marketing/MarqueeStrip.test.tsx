import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarqueeStrip } from "./MarqueeStrip";

describe("MarqueeStrip", () => {
  afterEach(cleanup);

  it("renders items on jointly reversing surface and ink tokens", () => {
    render(<MarqueeStrip items={["신한카드", "현대카드"]} />);
    expect(screen.getByRole("region", { name: "지원 카드사" })).toHaveStyle({
      background: "var(--color-inverse-canvas)", color: "var(--color-inverse-ink)",
    });
  });

  it("uses linear animation and stops it for reduced motion", () => {
    const source = readFileSync(resolve("src/components/marketing/MarqueeStrip.tsx"), "utf8");
    expect(source).toMatch(/animation:[^;]+linear infinite/);
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("animation: none");
    expect(source).not.toMatch(/bounce|ease-in|ease-out/);
  });
});
