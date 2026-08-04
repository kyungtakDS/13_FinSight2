import type { Insight } from "@/types/report";
interface InsightListProps { insights: Insight[] }

export function InsightList({ insights }: InsightListProps) {
  if (insights.length === 0) return <section aria-labelledby="insight-title"><h2 id="insight-title" className="fs-section-title">인사이트</h2><p className="fs-muted">표시할 인사이트가 없습니다.</p></section>;
  return <section aria-labelledby="insight-title"><h2 id="insight-title" className="fs-section-title">인사이트</h2>
    <div className="fs-grid-3">{insights.map((insight) => <article className="fs-card" key={insight.id}><h3 className="fs-h">{insight.title}</h3><p className="fs-muted">{insight.body}</p></article>)}</div>
  </section>;
}
