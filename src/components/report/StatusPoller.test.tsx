import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { StatusPoller } from "./StatusPoller";

describe("StatusPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls processing uploads every two seconds and cleans up on unmount", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "processing" })));
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = render(<StatusPoller uploadId="upload-1" status="processing" />);
    await act(() => vi.advanceTimersByTimeAsync(1999));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetch).toHaveBeenCalledTimes(1);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it.each(["completed", "failed"] as const)("does not poll an initial %s status", async (status) => {
    render(<StatusPoller uploadId="upload-1" status={status} />);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes and stops after a terminal response", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "completed" })));
    render(<StatusPoller uploadId="upload-1" status="processing" />);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(refresh).toHaveBeenCalledOnce();
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("silently waits for the next cycle after a network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(
      new Response(JSON.stringify({ status: "processing" })),
    );
    render(<StatusPoller uploadId="upload-1" status="processing" />);
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("stops after ten minutes and asks the user to refresh", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ status: "processing" })));
    render(<StatusPoller uploadId="upload-1" status="processing" />);
    await act(() => vi.advanceTimersByTimeAsync(600_000));
    expect(screen.getByText("예상보다 오래 걸립니다. 새로고침해 주세요")).toBeInTheDocument();
    const calls = vi.mocked(fetch).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
});
