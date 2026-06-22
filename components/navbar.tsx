"use client";

import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import PillNav, { type PillNavItem } from "./PillNav";

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
    ? [{ label: "Home", href: "/" }]
    : session
    ? [
        { label: "Home", href: "/" },
        { label: "Profile", href: "/profile" },
        { label: "Admin", href: "/admin" },
        { label: "Logout", onClick: () => void handleLogout() }
      ]
    : [
        { label: "Home", href: "/" },
        { label: "Register", href: "/register" },
        { label: "Login", href: "/login" }
      ];

  return (
    <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
      <PillNav
        logo="/logo.svg"
        logoAlt="SentinelStack"
        items={items}
        activeHref={pathname}
        baseColor="#0f172a"
        pillColor="#22d3ee"
        pillTextColor="#0f172a"
        hoveredPillTextColor="#22d3ee"
        initialLoadAnimation={false}
      />
    </div>
  );
}
