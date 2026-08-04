const steps = [
  ["01", "Google 가입", "Google 계정으로 로그인해 업로드한 파일의 소유자를 명확히 합니다."],
  ["02", "CSV 업로드", "카드사에서 받은 CSV를 올리면 인코딩과 컬럼 구조를 자동 판별합니다."],
  ["03", "자동 분석", "거래별로 사업 경비, 개인 지출, 애매 후보를 분류합니다."],
  ["04", "리포트 확인", "예상 절감액과 인사이트를 보고 Pro에서 전체 내역을 내려받습니다."],
] as const;

export function Steps() {
  return (
    <section id="how" style={{ margin: "0 auto", maxWidth: "var(--container-max)", padding: "var(--space-section) var(--space-lg)" }}>
      <h2 className="t-display-lg" style={{ margin: "0 0 var(--space-xl)" }}>네 단계면 정리가 끝납니다</h2>
      <div style={{ display: "grid", gap: "var(--space-lg)", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-section), 1fr))" }}>
        {steps.map(([number, title, description]) => (
          <article key={number} style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            <span className="t-eyebrow" data-testid="step-number" style={{ color: "var(--fs-accent)" }}>{number}</span>
            <h3 className="t-card-title" style={{ margin: 0 }}>{title}</h3>
            <p className="t-body-sm" style={{ margin: 0 }}>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
