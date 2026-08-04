import type { CSSProperties } from "react";

interface FooterLink { label: string; href: string }
interface FooterColumn { head: string; links: FooterLink[] }

export interface FooterProps {
  brand: string;
  columns: FooterColumn[];
  style?: CSSProperties;
}

export function Footer({ brand, columns, style }: FooterProps) {
  return (
    <footer style={{ background: "var(--color-canvas)", borderTop: "var(--space-hair) solid var(--color-hairline)", color: "var(--color-ink)", padding: "var(--space-section) var(--space-xl)", ...style }}>
      <div style={{ display: "grid", gap: "var(--space-xl)", gridTemplateColumns: "repeat(auto-fit, minmax(0, 1fr))", margin: "0 auto", maxWidth: "var(--container-max)" }}>
        <div className="t-headline">{brand}</div>
        {columns.map((column) => (
          <div key={column.head} style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            <span className="t-caption">{column.head}</span>
            <ul style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", listStyle: "none", margin: 0, padding: 0 }}>
              {column.links.map((link) => <li key={link.href}><a className="t-body-sm" href={link.href} style={{ color: "var(--color-ink)", textDecoration: "none" }}>{link.label}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
