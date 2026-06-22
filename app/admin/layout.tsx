"use client";

import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <div className="min-h-[calc(100vh-65px)]">
      <div className="border-b border-slate-800 bg-slate-950/90 backdrop-blur px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <h1 className="text-white font-bold text-sm">SentinelStack Command Center</h1>
        </div>
        <div className="flex items-center gap-4">
          {address && (
            <span className="text-slate-400 text-xs font-mono hidden sm:inline-block">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          )}
          <button
            onClick={() => {
              disconnect();
              document.cookie = "admin_wallet=; path=/; max-age=0";
              window.location.href = "/admin/connect";
            }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
          >
            Disconnect
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
