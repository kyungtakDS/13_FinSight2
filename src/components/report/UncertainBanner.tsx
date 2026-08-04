interface UncertainBannerProps { uncertainCount: number }

export function UncertainBanner({ uncertainCount }: UncertainBannerProps) {
  if (uncertainCount === 0) return null;
  return <aside style={{ background: "var(--fs-unsure-soft)", border: "var(--space-hair) solid var(--fs-unsure)", borderRadius: "var(--radius-md)", padding: "var(--space-md)", color: "var(--fs-unsure)" }}>
    <strong className="num">애매 {uncertainCount.toLocaleString("ko-KR")}건을 숨기지 않고 표시합니다.</strong>
    <div className="fs-muted">업종을 특정하기 어려운 거래입니다. 세무사에게 따로 확인하세요.</div>
  </aside>;
}
