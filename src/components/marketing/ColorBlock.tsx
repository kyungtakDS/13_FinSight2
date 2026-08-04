import type { CSSProperties, ReactNode } from "react";

type ColorBlockVariant = "lime" | "lilac" | "cream" | "mint" | "pink" | "coral" | "navy";

export interface ColorBlockProps {
  variant?: ColorBlockVariant;
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
  align?: "left" | "center";
  bleed?: boolean;
  style?: CSSProperties;
}

export function ColorBlock({ variant = "lime", eyebrow, title, children, align = "left", bleed = false, style }: ColorBlockProps) {
  return (
    <section
      aria-label={title}
      className={bleed ? "marketing-color-block--bleed" : undefined}
      style={{
        background: `var(--color-block-${variant})`,
        borderRadius: bleed ? 0 : "var(--radius-lg)",
        boxSizing: "border-box",
        color: variant === "navy" ? "var(--color-block-ink-inverse)" : "var(--color-block-ink)",
        padding: "var(--space-xxl)",
        textAlign: align,
        ...style,
      }}
    >
      <div style={{ alignItems: align === "center" ? "center" : "flex-start", display: "flex", flexDirection: "column", gap: "var(--space-lg)", margin: align === "center" ? "0 auto" : 0, maxWidth: "var(--container-max)" }}>
        {eyebrow ? <span className="t-eyebrow">{eyebrow}</span> : null}
        {title ? <h2 className="t-display-lg" style={{ margin: 0 }}>{title}</h2> : null}
        {children ? <div className="t-subhead">{children}</div> : null}
      </div>
    </section>
  );
}
