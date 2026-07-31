import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

function mockSystemTheme(prefersDark: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" && prefersDark,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("아이콘 전용 버튼에 aria-label을 제공한다", () => {
    mockSystemTheme(false);
    render(<ThemeToggle />);

    expect(screen.getByRole("button")).toHaveAccessibleName();
  });

  it("저장된 테마가 없으면 시스템 다크 모드 설정을 따른다", () => {
    mockSystemTheme(true);
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("클릭하면 html의 테마를 light와 dark 사이에서 전환한다", () => {
    mockSystemTheme(false);
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    fireEvent.click(screen.getByRole("button"));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("클릭한 테마를 localStorage에 저장한다", () => {
    mockSystemTheme(false);
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button"));

    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("마운트 시 저장된 테마가 시스템 설정보다 우선한다", () => {
    localStorage.setItem("theme", "light");
    mockSystemTheme(true);
    render(<ThemeToggle />);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
