import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransactionTable, type ReportTransaction } from "./TransactionTable";

const transactions: ReportTransaction[] = [
  { rowIndex: 1, txnDate: "2026-01-02", merchant: "업무용품점", amount: 12000, accountCode: "welfare", verdict: "expense", reason: "직원 복리후생 목적" },
  { rowIndex: 2, txnDate: "2026-01-03", merchant: "개인사용처", amount: 9000, accountCode: "etc", verdict: "personal" },
  { rowIndex: 3, txnDate: "2026-01-04", merchant: "확인필요처", amount: -8900, accountCode: null, verdict: "uncertain", reason: null },
];

describe("TransactionTable", () => {
  afterEach(cleanup);

  it("renders an accessible real table inside the horizontal scroll wrapper", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(<TransactionTable transactions={transactions} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector(".fs-tablewrap > table.fs-table")).toBeInTheDocument();
    expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(6);
    for (const heading of ["날짜", "가맹점", "금액", "계정과목", "판정", "근거"]) {
      expect(screen.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("formats amounts, preserves negative cancellation styling, and localizes accounts", () => {
    const { container } = render(<TransactionTable transactions={transactions} />);
    const amounts = container.querySelectorAll("td.amt.num");
    expect(amounts).toHaveLength(3);
    expect(amounts[2]).toHaveTextContent("-₩8,900");
    expect(amounts[2]).toHaveClass("neg");
    expect(amounts[2]).toHaveStyle({ color: "var(--fs-unsure)" });
    expect(screen.getByText("복리후생비")).toBeInTheDocument();
    expect(screen.queryByText("welfare")).not.toBeInTheDocument();
  });

  it("maps all verdict chips and leaves a missing reason blank", () => {
    const { container } = render(<TransactionTable transactions={transactions} />);
    expect(screen.getByText("사업 경비")).toHaveClass("chip-biz");
    expect(screen.getByText("개인 지출")).toHaveClass("chip-personal");
    expect(screen.getByText("애매")).toHaveClass("chip-unsure");
    const lastReason = container.querySelector("tbody tr:last-child td.reason");
    expect(lastReason).toBeEmptyDOMElement();
    expect(container).not.toHaveTextContent("null");
    expect(container).not.toHaveTextContent("undefined");
  });

  it("reuses the report amount formatter and renders nothing for no transactions", () => {
    const source = readFileSync(resolve("src/components/report/TransactionTable.tsx"), "utf8");
    expect(source).toContain('import { formatWon } from "./format"');
    const { container } = render(<TransactionTable transactions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
