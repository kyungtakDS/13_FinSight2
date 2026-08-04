import type { AccountBreakdown } from "@/types/report";
import { formatWon } from "./format";

type DisplayAccount = AccountBreakdown & { verdict?: "expense" | "personal" | "uncertain" };
interface AccountDonutProps { accounts: DisplayAccount[]; txnCount: number }

function Money({ amount }: { amount: number }) {
  const won = formatWon(amount);
  return <span className="num">{won.sign}<span style={{ fontSize: "0.6em" }}>{won.currency}</span>{won.digits}</span>;
}

function AccountTable({ accounts }: { accounts: DisplayAccount[] }) {
  return <div className="fs-tablewrap"><table className="fs-table">
    <thead><tr><th scope="col">계정과목</th><th scope="col">건수</th><th scope="col" style={{ textAlign: "right" }}>금액</th></tr></thead>
    <tbody>{accounts.map((account) => <tr key={account.code}><td>{account.label}</td><td className="num">{account.count.toLocaleString("ko-KR")}건</td><td className="amt"><Money amount={account.total} /></td></tr>)}</tbody>
  </table></div>;
}

export function AccountDonut({ accounts, txnCount }: AccountDonutProps) {
  const displayAccounts = accounts.filter((account) => account.verdict !== "uncertain");
  if (displayAccounts.length === 0) return null;
  if (txnCount <= 3) return <section aria-labelledby="account-title"><h2 id="account-title" className="fs-section-title">계정과목별 집계</h2><AccountTable accounts={displayAccounts} /></section>;

  return <section className="fs-card" aria-labelledby="account-title">
    <h2 id="account-title" className="fs-section-title">계정과목별 집계</h2>
    <div style={{ display: "flex", gap: "var(--space-xl)", alignItems: "center", flexWrap: "wrap" }}>
      <svg className="fs-donut" width="100%" viewBox="0 0 40 40" role="img" aria-label="계정과목별 경비 후보 구성">
        <circle cx="20" cy="20" r="15.9" fill="none" stroke="var(--color-hairline-soft)" strokeWidth="8" />
        {displayAccounts.map((account, index) => {
          const currentOffset = displayAccounts.slice(0, index).reduce((sum, item) => sum + item.ratio * 100, 0);
          return <circle data-segment="true" key={account.code} cx="20" cy="20" r="15.9" fill="none" pathLength="100" stroke={`var(--fs-chart-${(index % 6) + 1})`} strokeWidth="8" strokeDasharray={`${account.ratio * 100} ${100 - account.ratio * 100}`} strokeDashoffset={-currentOffset} transform="rotate(-90 20 20)" />;
        })}
      </svg>
      <div style={{ flex: 1, minWidth: "min(100%, var(--space-section))" }}>{displayAccounts.map((account, index) => <div className="fs-legend-row" key={account.code}>
        <span className="sw" aria-hidden="true" style={{ background: `var(--fs-chart-${(index % 6) + 1})` }} />
        <span style={{ flex: 1 }}>{account.label}</span>
        <span className="num fs-muted">{(account.ratio * 100).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%</span>
        <Money amount={account.total} />
      </div>)}</div>
    </div>
  </section>;
}
