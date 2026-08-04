import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  afterEach(cleanup);

  it("renders an anchor only when href is supplied", () => {
    const { rerender } = render(<Button href="/start">시작</Button>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/start");
    rerender(<Button>시작</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it.each(["primary", "secondary", "tertiary", "magenta"] as const)(
    "gives the %s variant a distinct class",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByText(variant)).toHaveClass(`marketing-button--${variant}`);
    },
  );

  it("does not invoke a disabled action", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>중지</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses token-based size, pill shape, and press motion", () => {
    const source = readFileSync(resolve("src/components/marketing/Button.tsx"), "utf8");
    expect(source).toContain("calc(var(--space-xxl) - var(--space-xxs))");
    expect(source).toContain("var(--radius-pill)");
    expect(source).toContain("scale(0.97)");
    expect(source).not.toContain("...rest");
    expect(source).not.toMatch(/\[key:\s*string\]/);
  });
});
