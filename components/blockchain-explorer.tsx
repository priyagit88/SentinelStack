"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Block {
  number: number;
  hash: string;
  timestamp: number;
  gasUsed: string;
  txCount: number;
}

interface SecurityLog {
  index: number;
  userId: string;
  action: string;
  riskScore: string;
  timestamp: number;
  txHash?: string;
}

interface NetworkInfo {
  chainId: string;
  blockNumber: number;
  gasPriceGwei: string;
  operatorAddress: string;
  operatorBalanceEth: string;
  contractAddress: string;
  isContractDeployed: boolean;
}

type TabKey = "blocks" | "logs" | "network";

export function BlockchainExplorer() {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("blocks");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBlockchainData();
    const interval = setInterval(fetchBlockchainData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchBlockchainData = async () => {
    try {
      setError(null);
      const res = await fetch("/api/admin/blockchain-info");
      const data = await res.json();
      if (data.success) {
        setNetwork(data.network);
        setBlocks(data.recentBlocks || []);
      } else {
        setError(data.error || "Blockchain network unavailable");
      }

      // Fetch on-chain security logs
      const logsRes = await fetch("/api/admin/blockchain-logs");
      const logsData = await logsRes.json();
      if (logsData.success) {
        setLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch blockchain data:", err);
      setError("Failed to connect to blockchain network");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-12 bg-slate-800 rounded"></div>
          <div className="h-12 bg-slate-800 rounded"></div>
          <div className="h-12 bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${error ? "bg-red-500" : "bg-green-500"} ${!error ? "animate-pulse" : ""}`}></div>
          <h2 className="text-white font-semibold">Blockchain Explorer</h2>
          {network && (
            <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded-full font-mono">
              Chain {network.chainId}
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {(["blocks", "logs", "network"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-6 py-4 bg-red-500/5 border-b border-red-500/10">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-400">{error}</p>
          </div>
          <div className="mt-2 text-xs text-slate-500 space-y-1">
            <p>1. Start local node: <code className="bg-slate-800 px-1 rounded">npx hardhat node</code></p>
            <p>2. Deploy contract: <code className="bg-slate-800 px-1 rounded">npx hardhat run scripts/deploy.js --network localhost</code></p>
            <p>3. Set <code className="bg-slate-800 px-1 rounded">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in .env.local</p>
          </div>
        </div>
      )}

      {/* Blocks Tab */}
      {activeTab === "blocks" && (
        <div className="divide-y divide-slate-800">
          {blocks.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              {error ? "Connect to blockchain to view blocks" : "No blocks found"}
            </div>
          ) : (
            blocks.map((block) => (
              <div key={block.number} className="px-6 py-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-indigo-400 font-mono text-sm">#{block.number}</span>
                    <span className="text-slate-500 text-xs">
                      {formatDistanceToNow(block.timestamp * 1000, { addSuffix: true })}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{block.txCount} txs</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                  <span className="truncate max-w-[200px]">Hash: {block.hash}</span>
                  <span>Gas: {block.gasUsed}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === "logs" && (
        <div className="divide-y divide-slate-800">
          {logs.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-500">
              {error ? "Connect to blockchain to view security logs" : "No security logs found on-chain"}
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.index} className="px-6 py-4 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-indigo-400 font-mono text-sm">Log #{log.index}</span>
                    <RiskBadge score={log.riskScore} />
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(log.timestamp * 1000, { addSuffix: true })}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">User:</span>
                    <span className="text-slate-300 ml-2 font-mono">{log.userId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Action:</span>
                    <span className="text-slate-300 ml-2">{log.action}</span>
                  </div>
                </div>
                {log.txHash && (
                  <div className="mt-2 text-xs text-slate-500 font-mono truncate">
                    Tx: {log.txHash}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Network Tab */}
      {activeTab === "network" && network && (
        <div className="px-6 py-4 space-y-0">
          <NetworkRow label="Contract Address" value={network.contractAddress || "Not deployed"} isMono />
          <NetworkRow label="Contract Deployed" value={network.isContractDeployed ? "Yes" : "No"} isStatus />
          <NetworkRow label="Operator Address" value={network.operatorAddress} isMono />
          <NetworkRow label="Operator Balance" value={`${network.operatorBalanceEth} ETH`} />
          <NetworkRow label="Current Block" value={`#${network.blockNumber}`} />
          <NetworkRow label="Gas Price" value={`${network.gasPriceGwei} Gwei`} />
        </div>
      )}

      {!network && !error && activeTab !== "logs" && (
        <div className="px-6 py-12 text-center text-slate-500">
          Waiting for blockchain data...
        </div>
      )}
    </div>
  );
}

function RiskBadge({ score }: { score: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-500/10 text-red-400 border-red-500/20",
    HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    MEDIUM: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    LOW: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[score] || colors.LOW}`}>
      {score}
    </span>
  );
}

function NetworkRow({ label, value, isMono, isStatus }: {
  label: string;
  value: string;
  isMono?: boolean;
  isStatus?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`text-sm ${isMono ? "font-mono text-slate-300" : "text-slate-200"} ${isStatus && value === "Yes" ? "text-green-400" : isStatus ? "text-red-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}
