import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LockedTable } from "./LockedTable";

describe("LockedTable", () => {
  afterEach(cleanup);

  it("accepts only a locked count and has no transaction-data prop", () => {
    const source = readFileSync(resolve("src/components/report/LockedTable.tsx"), "utf8");
    expect(source).not.toMatch(/transactions/i);
    render(<LockedTable lockedCount={342} />);
    expect(screen.getByText(/342건/)).toBeInTheDocument();
  });

  it("renders six aria-hidden skeleton rows without plausible fake merchants", () => {
    const { container } = render(<LockedTable lockedCount={342} />);
    const blur = container.querySelector(".fs-lockblur");
    expect(blur).toHaveAttribute("aria-hidden", "true");
    expect(blur?.querySelectorAll("tbody tr")).toHaveLength(6);
    expect(container).not.toHaveTextContent(/스타벅스|편의점|커피|₩\d/);
  });

  it("describes what is locked before its Pro CTA and links through upgrade", () => {
    const { container } = render(<LockedTable lockedCount={342} />);
    const scrim = container.querySelector(".fs-lockscrim");
    expect(scrim).not.toHaveAttribute("aria-hidden");
    expect(scrim).toHaveTextContent("거래 342건의 계정과목 · 경비 판정 · 판정 근거가 잠겨 있습니다");
    expect(scrim).toHaveTextContent("세무사 전달용 파일 다운로드도 Pro에서 열립니다");
    const cta = screen.getByRole("link", { name: "Pro 시작하기" });
    expect(cta).toHaveAttribute("href", "/upgrade");
    expect((scrim?.textContent ?? "").indexOf("잠겨 있습니다")).toBeLessThan((scrim?.textContent ?? "").indexOf("Pro 시작하기"));
  });
});
