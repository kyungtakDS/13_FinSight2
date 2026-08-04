import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsightList } from "./InsightList";

const insights = Array.from({ length: 5 }, (_, index) => ({ id: `i${index}`, title: `인사이트 ${index}`, body: `내용 ${index}` }));

describe("InsightList", () => {
  afterEach(cleanup);
  it.each([3, 5])("renders all %i server-gated insights", (count) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<InsightList insights={insights.slice(0, count)} />);
    expect(screen.getAllByRole("article")).toHaveLength(count);
    expect(screen.getByText(`인사이트 ${count - 1}`)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("shows a useful empty state without empty cards", () => {
    const { container } = render(<InsightList insights={[]} />);
    expect(screen.getByText(/표시할 인사이트가 없습니다/)).toBeInTheDocument();
    expect(container.querySelector(".fs-card")).not.toBeInTheDocument();
  });
});
