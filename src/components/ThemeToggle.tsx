"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const themeChangeEvent = "finsight-theme-change";

function getPreferredTheme(): Theme {
  const storedTheme = localStorage.getItem("theme");

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(themeChangeEvent));
}

function subscribeToTheme(callback: () => void) {
  window.addEventListener(themeChangeEvent, callback);
  return () => window.removeEventListener(themeChangeEvent, callback);
}

function getThemeSnapshot(): Theme {
  const documentTheme = document.documentElement.dataset.theme;
  return documentTheme === "dark" || documentTheme === "light"
    ? documentTheme
    : getPreferredTheme();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    () => "light",
  );

  useEffect(() => {
    applyTheme(getPreferredTheme());
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  }

  const label = theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환";

  return (
    <button
      aria-label={label}
      onClick={toggleTheme}
      style={{
        alignItems: "center",
        background: "var(--color-surface-soft)",
        border: "var(--space-hair) solid var(--color-hairline)",
        borderRadius: "var(--radius-full)",
        color: "var(--color-ink)",
        cursor: "pointer",
        display: "inline-flex",
        height: "var(--space-xxl)",
        justifyContent: "center",
        padding: 0,
        width: "var(--space-xxl)",
      }}
      type="button"
    >
      {theme === "light" ? (
        <svg
          aria-hidden="true"
          fill="none"
          height="var(--space-lg)"
          viewBox="0 0 24 24"
          width="var(--space-lg)"
        >
          <path
            d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          fill="none"
          height="var(--space-lg)"
          viewBox="0 0 24 24"
          width="var(--space-lg)"
        >
          <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.75"
          />
        </svg>
      )}
    </button>
  );
}
