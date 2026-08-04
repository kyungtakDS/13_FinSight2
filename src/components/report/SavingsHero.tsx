import { formatWon } from "./format";

interface SavingsHeroProps { estimatedSaving: number; taxRate: number }

export function SavingsHero({ estimatedSaving, taxRate }: SavingsHeroProps) {
  const won = formatWon(estimatedSaving);
  return <section className="fs-card" aria-labelledby="saving-title" style={{ background: "var(--fs-accent-soft)", borderColor: "var(--fs-accent-line)" }}>
    <h2 id="saving-title" className="fs-h" style={{ color: "var(--fs-accent)" }}>예상 절감액(참고용)</h2>
    <div className="fs-metric-big num" style={{ color: "var(--fs-accent)", display: "flex", alignItems: "baseline", gap: "0.06em" }}>
      {won.sign}<span style={{ fontSize: "0.6em", fontWeight: 480 }}>{won.currency}</span>{won.digits}
    </div>
    <p className="fs-muted">{(taxRate * 100).toLocaleString("ko-KR")}% 최저 세율 기준 보수적 추정입니다. 애매한 거래는 제외했습니다.</p>
  </section>;
}
