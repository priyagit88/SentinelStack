import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
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
            <Navbar />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
