"use client";

import { PricingCard } from "./PricingCard";

// Polar 상품 설정이 청구 source of truth이므로 상품 가격 변경 시 이 상수도 맞춘다.
const PRO_MONTHLY_PRICE = "₩9,900";

export function Pricing() {
  function goToUpgrade() {
    window.location.assign("/upgrade");
  }

  return (
    <section id="pricing" style={{ margin: "0 auto", maxWidth: "var(--container-max)", padding: "var(--space-section) var(--space-lg)" }}>
      <div style={{ marginBottom: "var(--space-xl)", textAlign: "center" }}>
        <span className="t-eyebrow">가격</span>
        <h2 className="t-display-lg" style={{ margin: "var(--space-xs) 0 0" }}>자기 숫자는 무료로, 쓸 수 있는 정리본은 Pro로</h2>
      </div>
      <div style={{ display: "grid", gap: "var(--space-lg)", gridTemplateColumns: "repeat(auto-fit, minmax(var(--space-section), 1fr))", margin: "0 auto" }}>
        <PricingCard
          blurb="먼저 자신의 카드 내역으로 핵심 결과를 확인합니다."
          ctaLabel="무료로 시작하기"
          features={["업로드·분석 무제한", "예상 절감액(참고용)", "상위 3개 인사이트"]}
          name="무료"
          onCta={() => document.querySelector("#start")?.scrollIntoView()}
          period="계속 무료"
          price="₩0"
        />
        <PricingCard
          blurb="전체 분류 내역과 세무사에게 전달할 파일을 엽니다."
          ctaLabel="Pro 시작하기"
          ctaVariant="primary"
          featured
          features={["무료의 모든 기능", "거래별 전체 분류와 판정 근거", "전체 인사이트", "세무사 전달용 파일 다운로드"]}
          name="Pro"
          onCta={goToUpgrade}
          period="/ 월"
          price={PRO_MONTHLY_PRICE}
        />
      </div>
      <p className="t-body-sm" style={{ margin: "var(--space-lg) auto 0", textAlign: "center" }}>
        결제·영수증·해지는 Polar 고객 포털에서 관리됩니다. 해지 후에도 데이터는 지우지 않습니다.
      </p>
    </section>
  );
}
