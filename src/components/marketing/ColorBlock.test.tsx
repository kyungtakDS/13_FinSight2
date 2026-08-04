import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ColorBlock } from "./ColorBlock";

const variants = ["lime", "lilac", "cream", "mint", "pink", "coral", "navy"] as const;

describe("ColorBlock", () => {
  afterEach(cleanup);

  it.each(variants)("uses the fixed %s background and matching ink", (variant) => {
    render(<ColorBlock variant={variant} title={variant}>내용</ColorBlock>);
    const block = screen.getByRole("region", { name: variant });
    expect(block).toHaveStyle({ background: `var(--color-block-${variant})` });
    expect(block).toHaveStyle({
      color: variant === "navy" ? "var(--color-block-ink-inverse)" : "var(--color-block-ink)",
    });
  });

  it("uses token padding and radius and supports align and bleed", () => {
    render(<ColorBlock variant="lime" title="제목" align="center" bleed>내용</ColorBlock>);
    const block = screen.getByRole("region", { name: "제목" });
    expect(block).toHaveStyle({ borderRadius: "0", textAlign: "center" });
    expect(block).toHaveClass("marketing-color-block--bleed");
    const source = readFileSync(resolve("src/components/marketing/ColorBlock.tsx"), "utf8");
    expect(source).toContain('padding: "var(--space-xxl)"');
  });

  it("never reads a theme-reversing ink token", () => {
    const source = readFileSync(resolve("src/components/marketing/ColorBlock.tsx"), "utf8");
    expect(source).not.toContain("--color-ink");
    expect(source).not.toContain("--color-inverse-ink");
  });
});
