import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UploadList, type UploadListItem } from "./UploadList";

const uploads: UploadListItem[] = [
  {
    id: "done-id",
    filename: "카드내역.csv",
    status: "completed",
    error_code: null,
    period_start: "2026-01-01",
    period_end: "2026-01-31",
    row_count: 1234,
    expires_at: "2099-05-01T00:00:00.000Z",
    created_at: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "processing-id",
    filename: null,
    status: "processing",
    error_code: null,
    period_start: null,
    period_end: null,
    row_count: null,
    expires_at: "2099-05-01T00:00:00.000Z",
    created_at: "2026-02-02T00:00:00.000Z",
  },
];

describe("UploadList", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders prop data without fetching and returns the empty state for no uploads", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { unmount } = render(<UploadList uploads={uploads} />);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("카드내역.csv")).toBeInTheDocument();

    unmount();
    render(<UploadList uploads={[]} />);
    expect(screen.getByRole("heading", { name: /CSV를 올려 시작하세요/ })).toBeInTheDocument();
  });

  it("identifies uploads by period and transaction count, with filename as supporting text", () => {
    render(<UploadList uploads={uploads} />);

    expect(screen.getByText("2026. 1. 1. ~ 2026. 1. 31.")).toBeInTheDocument();
    expect(screen.getByText("1,234건")).toHaveClass("num");
    expect(screen.getByText("카드내역.csv")).toBeInTheDocument();
    expect(screen.getByText("기간 분석 중")).toBeInTheDocument();
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });

  it("shows status without inventing a percentage and links every item to its report", () => {
    render(<UploadList uploads={uploads} />);

    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /2026\. 1\. 1\./ })).toHaveAttribute(
      "href",
      "/dashboard/uploads/done-id",
    );
    expect(screen.getByRole("link", { name: /기간 분석 중/ })).toHaveAttribute(
      "href",
      "/dashboard/uploads/processing-id",
    );
  });

  it("uses the fixed error vocabulary and marks expired originals without locking reports", () => {
    render(
      <UploadList
        now={new Date("2026-05-02T00:00:00.000Z")}
        uploads={[{ ...uploads[0], status: "failed", error_code: "parse_failed", expires_at: "2026-05-01T00:00:00.000Z" }]}
      />,
    );

    expect(screen.getByText("실패")).toBeInTheDocument();
    expect(screen.getByText(/CSV 파일을 읽지 못했습니다/)).toBeInTheDocument();
    expect(screen.getByText("원본 만료 — 재시도 불가")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/dashboard/uploads/done-id");
    expect(screen.queryByText(/잠금/)).not.toBeInTheDocument();
  });

  it("uses an accessible real table inside the scrolling wrapper", () => {
    const { container } = render(<UploadList uploads={uploads} />);

    expect(container.querySelector(".fs-tablewrap > table.fs-table")).not.toBeNull();
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
    expect(screen.getAllByRole("button", { name: /업로드 삭제/ })).toHaveLength(2);
  });

  it("confirms inline, deletes through the route, and removes the successful row", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    render(<UploadList uploads={[uploads[0]]} />);

    fireEvent.click(screen.getByRole("button", { name: "카드내역.csv 업로드 삭제" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("원본 파일과 분석 내역이 함께 삭제됩니다");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제하기" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith("/api/uploads/done-id", { method: "DELETE" }));
    await waitFor(() => expect(screen.queryByText("카드내역.csv")).not.toBeInTheDocument());
  });

  it("keeps the row and shows a fixed message when deletion fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "upstream" }), { status: 500 }),
    );
    render(<UploadList uploads={[uploads[0]]} />);

    fireEvent.click(screen.getByRole("button", { name: "카드내역.csv 업로드 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("요청을 처리하지 못했습니다");
    expect(screen.getByText("카드내역.csv")).toBeInTheDocument();
  });
});
