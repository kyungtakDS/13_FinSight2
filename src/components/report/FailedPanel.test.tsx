import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ERROR_MESSAGES } from "@/components/upload/Dropzone";
import { FailedPanel } from "./FailedPanel";

describe("FailedPanel", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.each(Object.entries(ERROR_MESSAGES))("renders the shared message for %s", (code, message) => {
    render(<FailedPanel uploadId="upload-1" errorCode={code} retriesLeft={2} />);
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("replaces unknown codes without exposing their raw value", () => {
    render(<FailedPanel uploadId="upload-1" errorCode="SQL secret" retriesLeft={2} />);
    expect(screen.getByText("분석에 실패했습니다")).toBeInTheDocument();
    expect(screen.queryByText("SQL secret")).not.toBeInTheDocument();
  });

  it("shows retries left and disables retry when none remain", () => {
    const { rerender } = render(<FailedPanel uploadId="upload-1" errorCode="analysis_failed" retriesLeft={2} />);
    expect(screen.getByRole("button", { name: /재시도.*2회 남음/ })).toBeEnabled();
    rerender(<FailedPanel uploadId="upload-1" errorCode="analysis_failed" retriesLeft={0} />);
    expect(screen.getByRole("button", { name: /재시도.*0회 남음/ })).toBeDisabled();
    expect(screen.getByText(/재시도 횟수를 모두 사용했습니다/)).toBeInTheDocument();
  });

  it("removes retry for expired originals and explains why", () => {
    render(<FailedPanel uploadId="upload-1" errorCode="expired" retriesLeft={2} />);
    expect(screen.queryByRole("button", { name: /재시도/ })).not.toBeInTheDocument();
    expect(screen.getByText("원본이 만료되어 재시도할 수 없습니다")).toBeInTheDocument();
  });

  it("posts a retry, disables while pending, and switches to processing after 202", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { resolveResponse = resolve; }));
    render(<FailedPanel uploadId="upload-1" errorCode="analysis_failed" retriesLeft={2} />);
    const button = screen.getByRole("button", { name: /재시도/ });
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledWith("/api/uploads/upload-1/retry", { method: "POST" });
    expect(button).toBeDisabled();
    resolveResponse(new Response(JSON.stringify({ retriesLeft: 1 }), { status: 202 }));
    expect(await screen.findByText(/탭을 닫아도 분석은 서버에서 계속됩니다/)).toBeInTheDocument();
  });

  it("shows only a fixed message when retry fails", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "SQL secret" }), { status: 500 }),
    );
    render(<FailedPanel uploadId="upload-1" errorCode="analysis_failed" retriesLeft={2} />);
    fireEvent.click(screen.getByRole("button", { name: /재시도/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("분석에 실패했습니다"));
    expect(screen.queryByText("SQL secret")).not.toBeInTheDocument();
  });
});
