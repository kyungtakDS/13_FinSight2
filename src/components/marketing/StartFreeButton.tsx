"use client";

import { START_ERROR_MESSAGE, useStartAction } from "@/components/auth/useStartAction";
import { Button } from "./Button";

export interface StartFreeButtonProps {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

/**
 * 랜딩 상단과 가격 카드에 각각 놓이는 "무료로 시작하기". 두 자리가 같은 동작을
 * 써야 하므로 컴포넌트 하나로 두고 스타일만 props 로 받는다.
 */
export function StartFreeButton({ variant = "primary", fullWidth = false }: StartFreeButtonProps) {
  const { start, isPending, hasFailed } = useStartAction();

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "var(--space-xs)",
        width: fullWidth ? "100%" : "auto",
      }}
    >
      <Button disabled={isPending} fullWidth={fullWidth} onClick={start} variant={variant}>
        무료로 시작하기
      </Button>
      {hasFailed ? (
        <span className="t-caption" role="alert">{START_ERROR_MESSAGE}</span>
      ) : null}
    </span>
  );
}
