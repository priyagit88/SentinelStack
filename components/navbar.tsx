"use client";

import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import PillNav, { type PillNavItem } from "./PillNav";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  // Build the pill items from auth state. Logout is an action item (no href).
  const items: PillNavItem[] = isPending
    ? []
    : session
    ? [
        { label: "Profile", href: "/profile" },
        { label: "Admin", href: "/admin" },
        { label: "Logout", onClick: () => void handleLogout() }
      ]
    : [
        { label: "Register", href: "/register" },
        { label: "Login", href: "/login" }
      ];

  return (
    // spacer + nav + toggle with justify-between keeps the pills centered
    // while the theme switcher sits on the right.
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
      <span aria-hidden className="h-9 w-9 shrink-0" />
      <PillNav
        logo="/logo.svg"
        logoAlt="SentinelStack"
        items={items}
        activeHref={pathname}
        baseColor="#0f172a"
        pillColor="#1e293b"
        pillTextColor="#e2e8f0"
        hoveredPillTextColor="#38bdf8"
        initialLoadAnimation={false}
      />
      <ThemeToggle />
    </div>
  );
}
