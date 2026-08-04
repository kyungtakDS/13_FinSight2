import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getUploadForUser, getProfilePlan, notFound } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUploadForUser: vi.fn(),
  getProfilePlan: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({
  notFound,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/server", () => ({ getUser }));
vi.mock("@/lib/supabase/service", () => ({ getUploadForUser, getProfilePlan }));

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
} as const;

describe("upload status page", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ id: "user-1" });
    getUploadForUser.mockResolvedValue(upload);
    getProfilePlan.mockResolvedValue("free");
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
