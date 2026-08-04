"use client";

import type { ChangeEventHandler, CSSProperties } from "react";

export interface TextInputProps {
  label: string;
  id: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  placeholder?: string;
  type?: string;
  as?: "input" | "textarea";
  rows?: number;
  style?: CSSProperties;
}

export function TextInput({ label, id, value, onChange, placeholder, type = "text", as = "input", rows = 4, style }: TextInputProps) {
  const fieldStyle: CSSProperties = {
    background: "var(--color-canvas)", border: "var(--space-hair) solid var(--color-hairline)",
    borderRadius: "var(--radius-md)", boxSizing: "border-box", color: "var(--color-ink)",
    fontFamily: "var(--font-sans)", fontSize: "var(--type-body-size)", fontWeight: "var(--type-body-weight)",
    lineHeight: "var(--type-body-lh)", padding: "var(--space-sm) var(--space-md)", width: "100%", ...style,
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      <label className="t-body-sm" htmlFor={id}>{label}</label>
      {as === "textarea" ? (
        <textarea id={id} value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={fieldStyle} />
      ) : (
        <input id={id} value={value} onChange={onChange} placeholder={placeholder} type={type} style={fieldStyle} />
      )}
    </div>
  );
}
