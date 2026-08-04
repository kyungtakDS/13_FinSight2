import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

type AppShellProps = {
  children: ReactNode;
  title: string;
};

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="fs-app">
      <Sidebar />
      <div className="fs-main">
        <Topbar title={title} />
        <main className="fs-content">{children}</main>
      </div>
    </div>
  );
}
