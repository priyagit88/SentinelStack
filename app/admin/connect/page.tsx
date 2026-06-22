"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SentinelAccessABI } from "@/lib/abis/SentinelAccess";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SENTINEL_ACCESS_CONTRACT as `0x${string}`;

export default function AdminConnectPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: isAdmin } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: SentinelAccessABI,
    functionName: "isAdmin",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { writeContract } = useWriteContract();

  useEffect(() => {
    if (isConnected && isAdmin) {
      setIsVerifying(true);
      // Record login on chain
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: SentinelAccessABI,
        functionName: "recordLogin",
      });
      // Set session cookie and redirect
      document.cookie = `admin_wallet=${address}; path=/; max-age=900`; // 15 min
      router.push("/admin");
    }
  }, [isConnected, isAdmin, address, router, writeContract]);

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

        {isConnected && !isAdmin && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">This wallet does not have admin privileges</p>
          </div>
        )}

        {isConnected && isAdmin && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 text-sm">Admin verified. Redirecting...</p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-slate-800">
          <p className="text-xs text-slate-500">
            Admin access is gated by an on-chain role in the SentinelAccess smart contract.
            Connect a wallet that has been granted the ADMIN_ROLE.
          </p>
        </div>
      </div>
    </div>
  );
}
