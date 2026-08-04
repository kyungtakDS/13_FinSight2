"use client";

export function EmptyState() {
  return (
    <section className="fs-card" aria-labelledby="empty-upload-title">
      <span className="fs-eyebrow">첫 분석</span>
      <h2 id="empty-upload-title" className="fs-page-title">카드 명세서 CSV를 올려 시작하세요</h2>
      <p>카드사마다 양식이 달라도 인코딩과 컬럼 구조를 자동으로 읽습니다.</p>
      <p className="fs-muted">CSV 전용 · 최대 2MB · 3,000행</p>
      <p><a href="#csv-upload">파일을 선택해 분석하기</a></p>
      <p><a href="#csv-download-guide">카드사별 CSV 내려받는 법</a></p>
    </section>
  );
}
