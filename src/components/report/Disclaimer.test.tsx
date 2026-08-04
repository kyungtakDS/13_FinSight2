import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Disclaimer } from "./Disclaimer";

describe("Disclaimer", () => {
  afterEach(cleanup);
  it("renders the required tax disclaimer from props only", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<Disclaimer />);
    expect(screen.getByText(/본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오/)).toHaveClass("fs-disclaimer");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
