import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname }));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  afterEach(cleanup);

  it("renders exactly the two supported navigation destinations", () => {
    usePathname.mockReturnValue("/dashboard");
    render(<Sidebar />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard",
      "/upgrade",
    ]);
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
  });

  it("marks the navigation item matching the current path", () => {
    usePathname.mockReturnValue("/dashboard/uploads/upload-id");
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "업로드와 기록" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Pro 업그레이드" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("uses a wordmark and dot without inventing a logo image", () => {
    usePathname.mockReturnValue("/dashboard");
    const { container } = render(<Sidebar />);

    expect(screen.getByText("FinSight")).toBeInTheDocument();
    expect(container.querySelector(".fs-brand .dot")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("attaches the responsive sidebar utility class", () => {
    usePathname.mockReturnValue("/dashboard");
    render(<Sidebar />);

    expect(screen.getByRole("navigation")).toHaveClass("fs-side");
  });
});
