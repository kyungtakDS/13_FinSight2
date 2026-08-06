import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { Dropzone, ERROR_MESSAGES } from "./Dropzone";

const csvFile = (content = "이용일자,가맹점명,이용금액\n2026-01-01,문구점,1000") =>
  new File([content], "card.csv", { type: "text/csv" });

describe("Dropzone", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("is an accessibly named label connected to a CSV file input", () => {
    render(<Dropzone />);
    const input = screen.getByLabelText("카드 명세서 CSV 파일 선택");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", ".csv,text/csv");
    expect(input.closest("label")).toHaveClass("fs-drop");
  });

  it("rejects a non-CSV file with conversion guidance without calling the server", async () => {
    render(<Dropzone />);
    fireEvent.change(screen.getByLabelText("카드 명세서 CSV 파일 선택"), {
      target: { files: [new File(["x"], "card.xlsx")] },
    });
    expect(await screen.findByText(/엑셀에서.*CSV.*저장/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects files over 2MB without calling the server", async () => {
    render(<Dropzone />);
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.csv");
    fireEvent.change(screen.getByLabelText("카드 명세서 CSV 파일 선택"), {
      target: { files: [file] },
    });
    expect(await screen.findByText(ERROR_MESSAGES.too_large)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("previews a valid file and uploads only after explicit confirmation", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ id: "upload-1" }), { status: 202 }),
    );
    render(<Dropzone />);
    await user.upload(screen.getByLabelText("카드 명세서 CSV 파일 선택"), csvFile());
    expect(await screen.findByText("이 파일을 이렇게 읽었습니다")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "분석 시작" }));
    expect(fetch).toHaveBeenCalledWith("/api/uploads", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard/uploads/upload-1"));
  });

  it("links to an existing analysis after a 409 response", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: "duplicate_file", existingUploadId: "old-1" }),
        { status: 409 },
      ),
    );
    render(<Dropzone />);
    await user.upload(screen.getByLabelText("카드 명세서 CSV 파일 선택"), csvFile());
    await user.click(await screen.findByRole("button", { name: "분석 시작" }));
    expect(await screen.findByText("이미 분석한 파일입니다")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "기존 분석 보기" })).toHaveAttribute(
      "href",
      "/dashboard/uploads/old-1",
    );
  });

  it("uses only the fixed error vocabulary and disables duplicate submission", async () => {
    const user = userEvent.setup();
    let resolveResponse!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => (resolveResponse = resolve)));
    render(<Dropzone />);
    await user.upload(screen.getByLabelText("카드 명세서 CSV 파일 선택"), csvFile());
    const submit = await screen.findByRole("button", { name: "분석 시작" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    resolveResponse(new Response(JSON.stringify({ error: "SQL secret" }), { status: 500 }));
    expect(await screen.findByText(ERROR_MESSAGES.upstream)).toBeInTheDocument();
    expect(screen.queryByText("SQL secret")).not.toBeInTheDocument();
    expect(Object.keys(ERROR_MESSAGES)).toEqual([
      "parse_failed", "rows_unreadable", "too_large", "duplicate_file", "analysis_failed",
      "upstream", "expired", "payment_required",
    ]);
  });

  // 파일은 정상적으로 읽혔고 행을 해석하지 못한 것이다. "CSV 파일을 읽지
  // 못했습니다" 라고 말하면 멀쩡한 파일을 의심하게 만든다 (#29).
  it("tells the user the rows were unreadable, not the file", () => {
    expect(ERROR_MESSAGES.rows_unreadable).toContain("거래 날짜");
    expect(ERROR_MESSAGES.rows_unreadable).not.toContain("CSV 파일을 읽지 못했습니다");
  });
});
