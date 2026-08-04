import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";

type TopbarProps = {
  title: string;
};

export function Topbar({ title }: TopbarProps) {
  return (
    <header className="fs-topbar">
      <h1>{title}</h1>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "var(--space-sm)",
        }}
      >
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
