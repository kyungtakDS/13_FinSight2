interface ReportHeaderProps { periodStart: string | null; periodEnd: string | null; txnCount: number }

export function ReportHeader({ periodStart, periodEnd, txnCount }: ReportHeaderProps) {
  const period = periodStart && periodEnd ? `${periodStart} ~ ${periodEnd}` : "기간 정보 없음";
  return <header>
    <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-xs)", flexWrap: "wrap" }}>
      <span className="fs-eyebrow">분석 완료</span><span className="fs-muted">{period}</span>
      <span className="fs-muted num">{txnCount.toLocaleString("ko-KR")}건</span>
    </div>
    <h1 className="fs-page-title">이 리포트는 파일 1개 기준입니다</h1>
    <p className="fs-muted">기간이 겹치는 다른 리포트와 직접 합산하면 거래가 중복될 수 있습니다.</p>
  </header>;
}
