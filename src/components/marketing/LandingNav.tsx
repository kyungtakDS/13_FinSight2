import { ThemeToggle } from "@/components/ThemeToggle";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "./Button";

export function LandingNav() {
  return (
    <header style={{ background: "var(--color-canvas)", borderBottom: "var(--space-hair) solid var(--color-hairline)" }}>
      <nav aria-label="주요 탐색" style={{ alignItems: "center", display: "flex", gap: "var(--space-lg)", margin: "0 auto", maxWidth: "var(--container-max)", padding: "var(--space-sm) var(--space-lg)" }}>
        <a href="#start" style={{ alignItems: "center", color: "var(--color-ink)", display: "inline-flex", fontWeight: 700, gap: "var(--space-xs)", marginRight: "auto", textDecoration: "none" }}>
          <span aria-hidden="true" data-brand-dot="true" style={{ background: "var(--fs-accent)", borderRadius: "var(--radius-full)", height: "var(--space-sm)", width: "var(--space-sm)" }} />
          <span className="t-headline">FinSight</span>
        </a>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "var(--space-md)" }}>
          <a className="t-body-sm" href="#how" style={{ color: "var(--color-ink)" }}>작동 방식</a>
          <a className="t-body-sm" href="#pricing" style={{ color: "var(--color-ink)" }}>가격</a>
          <a className="t-body-sm" href="#data" style={{ color: "var(--color-ink)" }}>데이터 처리</a>
          <ThemeToggle />
          {/* .fs-google is an app-layer class with width: 100%. Left unconstrained
              it fills the nav row and wraps the header onto three lines. */}
          <span style={{ width: "max-content" }}>
            <GoogleSignInButton />
          </span>
          <Button href="#start">무료로 시작하기</Button>
        </div>
      </nav>
    </header>
  );
}
