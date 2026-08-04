"use client";

import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export interface IconButtonProps {
  children: ReactNode;
  variant?: "default" | "inverse";
  size?: number | string;
  disabled?: boolean;
  ariaLabel: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
}

export function IconButton({ children, variant = "default", size = "var(--space-xxl)", disabled = false, ariaLabel, onClick, style }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`marketing-icon-button marketing-icon-button--${variant}`}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{
        alignItems: "center", border: 0, borderRadius: "var(--radius-full)", cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", height: size, justifyContent: "center", minWidth: size, padding: 0, width: size,
        ...(variant === "default"
          ? { background: "var(--color-surface-soft)", color: "var(--color-ink)" }
          : { background: "var(--icon-inverse-surface)", color: "var(--color-block-ink-inverse)" }),
        ...style,
      }}
    >
      {children}
    </button>
  );
}
