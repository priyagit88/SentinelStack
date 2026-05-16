import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelStack",
  description: "Secure authentication, real-time tracking, and AI-powered visual threat intelligence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen cyber-grid">
          <header className="border-b border-cyan-300/10 bg-slate-950/70 backdrop-blur">
            <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
              <Link href="/" className="text-lg font-semibold tracking-wide text-cyan-100">
                SentinelStack
              </Link>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Link className="hover:text-cyan-200" href="/register">
                  Register
                </Link>
                <Link className="hover:text-cyan-200" href="/login">
                  Login
                </Link>
                <Link className="hover:text-cyan-200" href="/profile">
                  Profile
                </Link>
                <Link className="hover:text-cyan-200" href="/admin">
                  Admin
                </Link>
              </div>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
