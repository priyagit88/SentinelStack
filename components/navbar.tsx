"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
      <Link href="/" className="text-lg font-semibold tracking-wide text-cyan-100">
        SentinelStack
      </Link>
      <div className="flex items-center gap-4 text-sm text-slate-300">
        {isPending ? null : session ? (
          <>
            <Link className="hover:text-cyan-200" href="/profile">
              Profile
            </Link>
            <Link className="hover:text-cyan-200" href="/admin">
              Admin
            </Link>
            <button 
              onClick={() => void handleLogout()} 
              className="hover:text-cyan-200"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link className="hover:text-cyan-200" href="/register">
              Register
            </Link>
            <Link className="hover:text-cyan-200" href="/login">
              Login
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
