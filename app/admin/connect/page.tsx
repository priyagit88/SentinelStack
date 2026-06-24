"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useSignMessage, useWriteContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SentinelAccessABI } from "@/lib/abis/SentinelAccess";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SENTINEL_ACCESS_CONTRACT as `0x${string}`;

export default function AdminConnectPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const { signMessageAsync } = useSignMessage();
  const { writeContract } = useWriteContract();
  const [status, setStatus] = useState<"idle" | "verifying">("idle");
  const [error, setError] = useState("");

  const { data: isAdmin, isLoading: roleLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SentinelAccessABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // Sign a fresh message (proves wallet ownership) → server verifies the
  // signature AND the on-chain ADMIN_ROLE before issuing the session cookie.
  async function handleVerify() {
    if (!address) return;
    setError("");
    setStatus("verifying");
    try {
      const message = `SentinelStack Admin Authentication\n\nAddress: ${address}\nIssued At: ${new Date().toISOString()}`;
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/admin/verify-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Verification failed.");
        setStatus("idle");
        return;
      }

      // Best-effort on-chain login record (separate tx; access doesn't depend on it).
      try {
        writeContract({
          address: CONTRACT_ADDRESS,
          abi: SentinelAccessABI,
          functionName: "recordLogin"
        });
      } catch {
        /* ignore — cookie is already set */
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e.shortMessage || e.message || "Signature rejected.");
      setStatus("idle");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">SentinelStack Admin</h1>
          <p className="text-slate-400 text-sm">Connect your admin wallet to access the command center</p>
        </div>

        <ConnectButton />

        {isConnected && roleLoading && (
          <p className="mt-4 text-slate-400 text-sm">Checking on-chain role…</p>
        )}

        {isConnected && isAdmin === false && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">This wallet does not have admin privileges</p>
          </div>
        )}

        {isConnected && isAdmin === true && (
          <button
            onClick={handleVerify}
            disabled={status === "verifying"}
            className="mt-4 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-colors"
          >
            {status === "verifying" ? "Verifying signature…" : "Sign in & Enter Command Center"}
          </button>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            Admin access is gated by an on-chain role in the SentinelAccess smart contract.
            You&apos;ll sign a message to prove ownership; the server verifies both the signature
            and your ADMIN_ROLE before granting access.
          </p>
        </div>
      </div>
    </div>
  );
}
