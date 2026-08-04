"use client";

import type { CSSProperties } from "react";
import { Button } from "./Button";

export interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  blurb?: string;
  features: string[];
  ctaLabel: string;
  ctaVariant?: "primary" | "secondary";
  featured?: boolean;
  onCta?: () => void;
  style?: CSSProperties;
}

export function PricingCard({ name, price, period, blurb, features, ctaLabel, ctaVariant = "secondary", featured = false, onCta, style }: PricingCardProps) {
  return (
    <article
      className={featured ? "marketing-pricing-card--featured" : undefined}
      style={{ background: "var(--color-canvas)", border: "var(--space-hair) solid var(--color-hairline)", borderColor: featured ? "var(--color-primary)" : "var(--color-hairline)", borderRadius: "var(--radius-lg)", boxSizing: "border-box", color: "var(--color-ink)", display: "flex", flexDirection: "column", gap: "var(--space-md)", padding: "var(--space-lg)", ...style }}
    >
      <h3 className="t-card-title" style={{ margin: 0 }}>{name}</h3>
      <div style={{ alignItems: "baseline", display: "flex", gap: "var(--space-xs)" }}>
        <span className="num t-display-lg">{price}</span>
        {period ? <span className="t-caption">{period}</span> : null}
      </div>
      {blurb ? <p className="t-body-sm" style={{ margin: 0 }}>{blurb}</p> : null}
      <Button variant={ctaVariant} fullWidth onClick={onCta}>{ctaLabel}</Button>
      <ul className="t-body-sm" style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", listStyle: "none", margin: 0, padding: 0 }}>
        {features.map((feature) => <li key={feature}>{feature}</li>)}
      </ul>
    </article>
  );
}
