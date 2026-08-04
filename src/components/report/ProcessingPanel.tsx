const ANALYSIS_STEPS = [
  ["파일 읽는 중", "카드 명세서의 행과 인코딩을 확인합니다"],
  ["양식 판별", "날짜, 가맹점, 금액 열을 찾습니다"],
  ["거래 분류", "경비 후보와 개인 지출을 구분합니다"],
  ["결과 집계", "서버에서 금액과 계정과목을 집계합니다"],
] as const;

export function ProcessingPanel() {
  return (
    <section className="fs-card" aria-labelledby="analysis-status-title">
      <span className="fs-eyebrow">분석 진행 중</span>
      <h1 id="analysis-status-title" className="fs-page-title">카드 명세서를 분석하고 있습니다</h1>
      <div className="fs-pbar" role="progressbar" aria-label="분석 진행 중">
        <span />
      </div>
      <div aria-label="분석 단계">
        {ANALYSIS_STEPS.map(([title, description]) => (
          <div className="fs-step active" key={title}>
            <span className="mark" aria-hidden="true"><span className="spin" /></span>
            <span>
              <strong>{title}</strong>
              <span className="fs-muted"> — {description}</span>
              <span className="fs-muted"> · 진행 중</span>
            </span>
          </div>
        ))}
      </div>
      <p className="fs-muted">탭을 닫아도 분석은 서버에서 계속됩니다.</p>
    </section>
  );
}
