import { accountLabel } from "@/types/account-codes";
import type { ClassifiedTxn, Verdict } from "@/types/transaction";

import { formatWon } from "./format";

export interface ReportTransaction extends ClassifiedTxn {
  reason?: string | null;
}

const verdictPresentation: Record<Verdict, { label: string; className: string }> = {
  expense: { label: "사업 경비", className: "chip-biz" },
  personal: { label: "개인 지출", className: "chip-personal" },
  uncertain: { label: "애매", className: "chip-unsure" },
};

function Amount({ amount }: { amount: number }) {
  const won = formatWon(amount);
  return <td className={`amt num${amount < 0 ? " neg" : ""}`} style={amount < 0 ? { color: "var(--fs-unsure)" } : undefined}>
    {won.sign}<span style={{ fontSize: "0.6em", fontWeight: 480 }}>{won.currency}</span>{won.digits}
  </td>;
}

export function TransactionTable({ transactions }: { transactions: readonly ReportTransaction[] }) {
  if (transactions.length === 0) return null;

  return <section aria-labelledby="transaction-table-title">
    <h2 id="transaction-table-title" className="fs-h">거래별 분류 내역</h2>
    <div className="fs-tablewrap">
      <table className="fs-table">
        <thead><tr>
          <th scope="col">날짜</th><th scope="col">가맹점</th><th scope="col" style={{ textAlign: "right" }}>금액</th>
          <th scope="col">계정과목</th><th scope="col">판정</th><th scope="col">근거</th>
        </tr></thead>
        <tbody>{transactions.map((transaction) => {
          const verdict = verdictPresentation[transaction.verdict];
          return <tr key={transaction.rowIndex}>
            <td className="num">{transaction.txnDate}</td>
            <td>{transaction.merchant}</td>
            <Amount amount={transaction.amount} />
            <td>{transaction.accountCode ? accountLabel(transaction.accountCode) : ""}</td>
            <td><span className={`fs-chip ${verdict.className}`}><span className="cd" aria-hidden="true" />{verdict.label}</span></td>
            <td className="reason">{transaction.reason ?? ""}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </section>;
}
