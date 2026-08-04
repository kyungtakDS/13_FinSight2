import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UncertainBanner } from "./UncertainBanner";

describe("UncertainBanner", () => {
  afterEach(cleanup);
  it("always exposes a positive uncertain count and asks for separate review", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<UncertainBanner uncertainCount={7} />);
    expect(screen.getByText(/애매 7건/)).toBeInTheDocument();
    expect(screen.getByText(/세무사에게 따로 확인/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("renders nothing when there are no uncertain transactions", () => {
    const { container } = render(<UncertainBanner uncertainCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
