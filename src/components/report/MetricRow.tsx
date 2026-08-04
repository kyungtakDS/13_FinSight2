import { formatWon } from "./format";

interface MetricRowProps { expenseTotal: number; personalTotal: number; uncertainTotal: number }
const metrics = [
  { key: "expense", label: "경비 후보", color: "var(--fs-biz)" },
  { key: "personal", label: "개인 지출", color: "var(--fs-personal)" },
  { key: "uncertain", label: "애매", color: "var(--fs-unsure)" },
] as const;

export function MetricRow({ expenseTotal, personalTotal, uncertainTotal }: MetricRowProps) {
  const values = { expense: expenseTotal, personal: personalTotal, uncertain: uncertainTotal };
  return <div className="fs-grid-3">{metrics.map((metric) => {
    const won = formatWon(values[metric.key]);
    return <section className="fs-card" key={metric.key} style={{ color: metric.color }}>
      <h2 className="fs-h">{metric.label}</h2>
      <div className="fs-metric num">{won.sign}<span style={{ fontSize: "0.6em" }}>{won.currency}</span>{won.digits}</div>
    </section>;
  })}</div>;
}
