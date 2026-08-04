"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

export interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary" | "magenta";
  size?: "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  type?: "button" | "submit" | "reset";
  style?: CSSProperties;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
  primary: { background: "var(--color-primary)", color: "var(--color-on-primary)" },
  secondary: {
    background: "var(--color-canvas)",
    color: "var(--color-ink)",
    boxShadow: "inset 0 0 0 var(--space-hair) var(--color-hairline)",
  },
  tertiary: { background: "transparent", color: "var(--color-ink)" },
  magenta: { background: "var(--color-accent-magenta)", color: "var(--color-on-primary)" },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  href,
  onClick,
  type = "button",
  style,
}: ButtonProps) {
  const composed: CSSProperties = {
    alignItems: "center",
    border: 0,
    borderRadius: "var(--radius-pill)",
    boxSizing: "border-box",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--type-button-size)",
    fontWeight: "var(--type-button-weight)",
    gap: "var(--space-xs)",
    justifyContent: "center",
    letterSpacing: "var(--type-button-ls)",
    lineHeight: "var(--type-button-lh)",
    minHeight: "calc(var(--space-xxl) - var(--space-xxs))",
    padding: size === "lg"
      ? "calc(var(--space-md) - var(--space-hair) * 2) calc(var(--space-xl) - var(--space-xxs))"
      : "calc(var(--space-sm) - var(--space-hair) * 2) calc(var(--space-lg) - var(--space-xxs))",
    textDecoration: "none",
    transition: "transform 120ms ease, opacity 120ms ease",
    whiteSpace: "nowrap",
    width: fullWidth ? "100%" : "auto",
    ...variantStyles[variant],
    ...style,
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  const className = `marketing-button marketing-button--${variant} marketing-button--${size}`;

  return (
    <>
      <style>{`.marketing-button:active:not(:disabled):not([aria-disabled="true"]){transform:scale(0.97)}.marketing-button:focus-visible{outline:var(--space-hair) solid currentColor;outline-offset:var(--space-xxs)}`}</style>
      {href ? (
        <a className={className} href={href} aria-disabled={disabled} onClick={handleClick} style={composed}>{children}</a>
      ) : (
        <button className={className} type={type} disabled={disabled} onClick={handleClick} style={composed}>{children}</button>
      )}
    </>
  );
}
