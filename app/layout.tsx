import type { Metadata } from "next";
import Script from "next/script";
import { Navbar } from "@/components/navbar";
import { Web3Provider } from "@/components/web3-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelStack",
  description: "Secure authentication, real-time tracking, and AI-powered visual threat intelligence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  return (
    <html lang="en">
      <body>
        {recaptchaSiteKey ? (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`}
            strategy="beforeInteractive"
          />
        ) : null}
        <Web3Provider>
          <div className="min-h-screen cyber-grid">
            <header className="border-b border-cyan-300/10 bg-slate-950/70 backdrop-blur">
              <Navbar />
            </header>
            {children}
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
