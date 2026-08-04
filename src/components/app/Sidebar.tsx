"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/dashboard", label: "업로드와 기록", icon: UploadIcon },
  { href: "/upgrade", label: "Pro 업그레이드", icon: UpgradeIcon },
] as const;

function UploadIcon() {
  return (
    <svg aria-hidden="true" className="ic" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v5h14v-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

function UpgradeIcon() {
  return (
    <svg aria-hidden="true" className="ic" fill="none" viewBox="0 0 24 24">
      <path
        d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="주요 메뉴" className="fs-side">
      <div className="fs-brand">
        <span>FinSight</span>
        <span aria-hidden="true" className="dot" />
      </div>
      {navigation.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`fs-navitem${isActive ? " active" : ""}`}
            href={href}
            key={href}
          >
            <Icon />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
