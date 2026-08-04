import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AppShell title="대시보드">{children}</AppShell>;
}
