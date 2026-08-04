import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IconButton } from "./IconButton";

describe("IconButton", () => {
  afterEach(cleanup);

  it("maps the required ariaLabel to aria-label", () => {
    render(<IconButton ariaLabel="테마 변경">icon</IconButton>);
    expect(screen.getByRole("button", { name: "테마 변경" })).toBeInTheDocument();
  });

  it("keeps inverse background and ink on fixed tokens", () => {
    render(<IconButton ariaLabel="메뉴" variant="inverse">icon</IconButton>);
    expect(screen.getByRole("button")).toHaveStyle({
      background: "var(--icon-inverse-surface)",
      color: "var(--color-block-ink-inverse)",
    });
  });
});
