import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Web3Provider } from "@/components/web3-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentinelStack",
  description: "Secure authentication, real-time tracking, and AI-powered visual threat intelligence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Resolve the active theme before first paint (no flash): explicit
            saved choice, else the device's prefers-color-scheme. Always writes
            data-theme so the CSS in globals.css needs no media queries. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');var d=(t==='light'||t==='dark')?t:((window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light');document.documentElement.setAttribute('data-theme',d);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();"
          }}
        />
      </head>
      <body>
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
