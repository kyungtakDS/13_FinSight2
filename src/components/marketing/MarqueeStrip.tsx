import type { CSSProperties } from "react";

export interface MarqueeStripProps {
  items: string[];
  style?: CSSProperties;
}

export function MarqueeStrip({ items, style }: MarqueeStripProps) {
  const track = [...items, ...items];
  return (
    <section aria-label="지원 카드사" style={{ alignItems: "center", background: "var(--color-inverse-canvas)", color: "var(--color-inverse-ink)", display: "flex", minHeight: "var(--space-xl)", overflow: "hidden", ...style }}>
      <style>{`@keyframes marketing-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.marketing-marquee-track{animation:marketing-marquee 28s linear infinite}@media (prefers-reduced-motion: reduce){.marketing-marquee-track{animation: none}}`}</style>
      <div className="marketing-marquee-track" style={{ display: "flex", gap: "var(--space-xl)", paddingInlineStart: "var(--space-xl)", whiteSpace: "nowrap" }}>
        {track.map((item, index) => <span className="t-body-sm" key={`${item}-${index}`}>{item}</span>)}
      </div>
    </section>
  );
}
