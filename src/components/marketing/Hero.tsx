import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "./Button";

export function Hero() {
  return (
    <section id="start" style={{ margin: "0 auto", maxWidth: "var(--container-max)", padding: "var(--space-section) var(--space-lg)" }}>
      <div data-testid="landing-hero" style={{ alignItems: "center", display: "flex", flexDirection: "column", gap: "var(--space-lg)", margin: "0 auto", textAlign: "center" }}>
        <span className="t-eyebrow">프리랜서·1인 사업자를 위한</span>
        <h1 className="t-display-xl" style={{ margin: 0 }}>카드 명세서를 올리면, 경비 후보가 정리됩니다</h1>
        <p className="t-body-lg" style={{ margin: 0 }}>수백 건의 카드 내역을 사업 경비 후보로 분류해 세무사에게 전달할 정리본을 만듭니다.</p>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "var(--space-sm)", justifyContent: "center" }}>
          <GoogleSignInButton />
          <Button href="#how" size="lg" variant="secondary">작동 방식 보기</Button>
        </div>
        <span className="t-caption">CSV 전용 · 원본은 90일 후 자동 삭제 · 본 서비스는 세무 자문이 아닙니다</span>
      </div>
    </section>
  );
}
