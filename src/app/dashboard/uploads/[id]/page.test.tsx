import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getUploadForUser, getProfilePlan, createClient, notFound } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUploadForUser: vi.fn(),
  getProfilePlan: vi.fn(),
  createClient: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/server", () => ({ getUser, createClient }));
// isRecomputing 은 CAS 와 같은 15분 창을 쓴다 — mock 으로 갈아치우면 화면이
// 실제 잠금 상태를 반영하는지 검증할 수 없다.
vi.mock("@/lib/supabase/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/service")>()),
  getUploadForUser,
  getProfilePlan,
}));

import UploadPage from "./page";

const upload = {
  id: "upload-1",
  userId: "user-1",
  storagePath: "user-1/upload-1.csv",
  filename: "card.csv",
  fileHash: "hash",
  status: "processing",
  errorCode: null,
  retryCount: 0,
  periodStart: null,
  periodEnd: null,
  rowCount: null,
  summary: null,
  expiresAt: "2099-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  finishedAt: null,
  recomputeStartedAt: null,
  recomputedAt: null,
} as const;

const completedSummary = {
  expenseTotal: 10000, personalTotal: 0, uncertainCount: 0, uncertainTotal: 0,
  estimatedSaving: 660, taxRate: 0.066, txnCount: 1, accounts: [], insights: [],
};

describe("upload status page", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ id: "user-1" });
    getUploadForUser.mockResolvedValue(upload);
    getProfilePlan.mockResolvedValue("free");
    createClient.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders processing status and its poller", async () => {
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    expect(screen.getByText(/탭을 닫아도 분석은 서버에서 계속됩니다/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders failed status with server-calculated retries left", async () => {
    getUploadForUser.mockResolvedValue({ ...upload, status: "failed", errorCode: "analysis_failed", retryCount: 1 });
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    expect(screen.getByRole("button", { name: /1회 남음/ })).toBeInTheDocument();
  });

  it("assembles the completed report from a server-gated summary", async () => {
    getUploadForUser.mockResolvedValue({ ...upload, status: "completed", periodStart: "2026-01-01", periodEnd: "2026-01-31", rowCount: 4, summary: {
      expenseTotal: 100000, personalTotal: 20000, uncertainCount: 1, uncertainTotal: 3000,
      estimatedSaving: 6600, taxRate: 0.066, txnCount: 4, accounts: [],
      insights: Array.from({ length: 5 }, (_, i) => ({ id: `${i}`, title: `인사이트 ${i}`, body: `내용 ${i}` })),
    } });
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    expect(screen.getByText("예상 절감액(참고용)")).toBeInTheDocument();
    expect(screen.getByText(/애매 1건/)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(getProfilePlan).toHaveBeenCalledWith("user-1");
    expect(screen.getByText(/거래 4건의 계정과목/)).toBeInTheDocument();
    expect(createClient).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent("비밀가맹점");
  });

  it("queries and renders transactions only for Pro", async () => {
    getProfilePlan.mockResolvedValue("pro");
    getUploadForUser.mockResolvedValue({ ...upload, status: "completed", rowCount: 1, summary: {
      expenseTotal: 10000, personalTotal: 0, uncertainCount: 0, uncertainTotal: 0,
      estimatedSaving: 660, taxRate: 0.066, txnCount: 1, accounts: [], insights: [],
    } });
    const results = {
      transactions: [{ row_index: 1, txn_date: "2026-01-02", merchant: "비밀가맹점", amount: 10000, account_code: "welfare", verdict: "expense" }],
      merchant_dictionary: [{ merchant_key: "비밀가맹점", reason: "업무 목적" }],
    };
    createClient.mockResolvedValue({
      from: (table: keyof typeof results) => {
        const chain = { select: () => chain, eq: () => chain, order: () => chain, in: () => chain,
          then: (resolve: (value: unknown) => unknown) => resolve({ data: results[table], error: null }) };
        return chain;
      },
    });
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    expect(screen.getByRole("table")).toHaveTextContent("비밀가맹점");
    expect(screen.getByRole("table")).toHaveTextContent("업무 목적");
    expect(screen.queryByRole("link", { name: "Pro 시작하기" })).not.toBeInTheDocument();
  });

  it("offers recomputation above the disclaimer on a completed report", async () => {
    getUploadForUser.mockResolvedValue({ ...upload, status: "completed", rowCount: 1, summary: completedSummary });
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    const button = screen.getByRole("button", { name: "다시 계산하기" });
    const disclaimer = screen.getByText(/본 서비스는 세무 자문이 아니며/);
    expect(button.compareDocumentPosition(disclaimer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // 원본이 파기된 뒤에는 누를 수 있는 버튼을 보여 줘도 409 만 돌아온다.
  it.each([
    [{ storagePath: null }, "a discarded original"],
    [{ expiresAt: "2020-01-01T00:00:00.000Z" }, "an expired original"],
  ])("hides recomputation for %s", async (overrides) => {
    getUploadForUser.mockResolvedValue({
      ...upload, status: "completed", rowCount: 1, summary: completedSummary, ...overrides,
    });
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    expect(screen.queryByRole("button", { name: "다시 계산하기" })).not.toBeInTheDocument();
  });

  it("keeps the stored report visible while a recompute is running", async () => {
    getUploadForUser.mockResolvedValue({
      ...upload, status: "completed", rowCount: 1, summary: completedSummary,
      recomputeStartedAt: new Date(Date.now() - 60_000).toISOString(),
    });
    render(await UploadPage({ params: Promise.resolve({ id: "upload-1" }) }));
    expect(screen.getByText(/완료될 때까지 기존 결과가 그대로 표시됩니다/)).toBeInTheDocument();
    expect(screen.getByText("예상 절감액(참고용)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 계산하기" })).not.toBeInTheDocument();
  });

  it("uses notFound for an unknown or another user's upload", async () => {
    getUploadForUser.mockResolvedValue(null);
    await expect(UploadPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("uses notFound without querying uploads when there is no user", async () => {
    getUser.mockResolvedValue(null);
    await expect(UploadPage({ params: Promise.resolve({ id: "upload-1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getUploadForUser).not.toHaveBeenCalled();
  });
});
