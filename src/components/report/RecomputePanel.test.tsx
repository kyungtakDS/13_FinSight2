import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RecomputePanel } from "./RecomputePanel";

const RUNNING_TEXT = /완료될 때까지 기존 결과가 그대로 표시됩니다/;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("RecomputePanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // 원본이 없으면 재계산 자체가 불가능하다 (ADR-005, 90일 파기).
  it("renders nothing when the original is gone or expired", () => {
    const { container } = render(
      <RecomputePanel uploadId="upload-1" canRecompute={false} recomputing={false} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("offers recomputation for a completed upload with its original", () => {
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);
    expect(screen.getByRole("button", { name: "다시 계산하기" })).toBeEnabled();
    expect(screen.queryByText(RUNNING_TEXT)).not.toBeInTheDocument();
  });

  it("disables the button while the request is in flight", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);
    const button = screen.getByRole("button", { name: "다시 계산하기" });

    fireEvent.click(button);

    expect(fetch).toHaveBeenCalledWith("/api/uploads/upload-1/recompute", { method: "POST" });
    expect(button).toBeDisabled();
    resolveResponse(jsonResponse({ recomputing: true }, 202));
    await vi.waitFor(() => expect(screen.getByText(RUNNING_TEXT)).toBeInTheDocument());
  });

  // 재계산이 도는 동안에도 화면은 기존 보고서를 그대로 들고 있어야 한다.
  it("promises the existing result stays visible while recomputing", () => {
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing />);
    expect(screen.getByText(RUNNING_TEXT)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 계산하기" })).not.toBeInTheDocument();
  });

  it("polls the upload and refreshes once the recompute is over", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ status: "completed", recomputing: true }, 200))
      .mockResolvedValueOnce(jsonResponse({ status: "completed", recomputing: false }, 200));
    const { rerender } = render(<RecomputePanel uploadId="upload-1" canRecompute recomputing />);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalledWith("/api/uploads/upload-1");
    expect(refresh).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    // refresh 가 서버 렌더를 다시 태워 recomputing 이 내려간다.
    rerender(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);
    expect(screen.getByRole("button", { name: "다시 계산하기" })).toBeInTheDocument();
  });

  // 202 로 시작한 재계산도 스스로 끝을 알아채야 한다 — prop 은 내내 false 다.
  it("returns to the button after a recompute it started finishes", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ recomputing: true }, 202))
      .mockResolvedValueOnce(jsonResponse({ status: "completed", recomputing: false }, 200));
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 계산하기" }));
    await vi.waitFor(() => expect(screen.getByText(RUNNING_TEXT)).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(2_000);

    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "다시 계산하기" })).toBeEnabled());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(RUNNING_TEXT)).not.toBeInTheDocument();
  });

  it("does not poll while idle", async () => {
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps polling when a poll fails", async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(jsonResponse({ status: "completed", recomputing: false }, 200));
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing />);

    await vi.advanceTimersByTimeAsync(4_000);

    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it("shows only a fixed message when the request is rejected", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "SQL secret" }, 500));
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 계산하기" }));

    await vi.waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ));
    expect(screen.queryByText("SQL secret")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 계산하기" })).toBeEnabled();
  });

  it("reports an expired original with the shared fixed message", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "expired" }, 409));
    render(<RecomputePanel uploadId="upload-1" canRecompute recomputing={false} />);

    fireEvent.click(screen.getByRole("button", { name: "다시 계산하기" }));

    await vi.waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(
      "원본 보관 기간이 지나 다시 분석할 수 없습니다.",
    ));
  });
});
