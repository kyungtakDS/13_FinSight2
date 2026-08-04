import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./Sidebar", () => ({
  Sidebar: () => <nav aria-label="주요 메뉴" />,
}));
vi.mock("./Topbar", () => ({
  Topbar: ({ title }: { title: string }) => <header>{title}</header>,
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  afterEach(cleanup);

  it("contains the sidebar and topbar landmarks", () => {
    render(<AppShell title="대시보드">내용</AppShell>);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toHaveTextContent("대시보드");
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("renders children inside the content utility", () => {
    render(<AppShell title="대시보드"><p>페이지 내용</p></AppShell>);

    expect(screen.getByText("페이지 내용").parentElement).toHaveClass("fs-content");
  });
});

const componentSources = [
  "app/AppShell.tsx",
  "app/Sidebar.tsx",
  "app/Topbar.tsx",
  "upload/Dropzone.tsx",
  "upload/DetectCard.tsx",
  "upload/EmptyState.tsx",
  "upload/UploadList.tsx",
  "report/ProcessingPanel.tsx",
  "report/FailedPanel.tsx",
  "report/StatusPoller.tsx",
  "report/ReportHeader.tsx",
  "report/SavingsHero.tsx",
  "report/MetricRow.tsx",
  "report/UncertainBanner.tsx",
  "report/InsightList.tsx",
  "report/AccountDonut.tsx",
  "report/Disclaimer.tsx",
  "report/TransactionTable.tsx",
  "report/LockedTable.tsx",
];
const allowedWeights = new Set(["320", "330", "340", "450", "480", "540", "700"]);

describe("app component design rules", () => {
  it.each(componentSources)("keeps %s within the shared design rules", (filename) => {
    const source = readFileSync(resolve("src/components", filename), "utf8");
    const declaredWeights = [...source.matchAll(/fontWeight:\s*["']?(\d+)/g)].map(
      ([, weight]) => weight,
    );

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b\d+px\b/);
    expect(declaredWeights.every((weight) => allowedWeights.has(weight))).toBe(true);
    expect(source).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(source).not.toContain("--color-block-");
  });
});
