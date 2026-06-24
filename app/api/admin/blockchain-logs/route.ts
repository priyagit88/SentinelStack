import { NextResponse } from "next/server";
import { ethers } from "ethers";
// Hardcoded ABI (not the gitignored Hardhat artifact) so this builds on Vercel.
import { SecurityLogRegistryABI } from "@/lib/abis/SecurityLogRegistry";

export const runtime = "nodejs";

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

/**
 * GET /api/admin/blockchain-logs
 * Returns the last 20 on-chain security log entries from the SecurityLogRegistry contract.
 */
export async function GET() {
  try {
    if (!contractAddress) {
      return NextResponse.json(
        { success: false, logs: [], error: "NEXT_PUBLIC_CONTRACT_ADDRESS is not configured" },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const contract = new ethers.Contract(contractAddress!, SecurityLogRegistryABI, provider);

    const logCount = await contract.getLogCount();
    const logs = [];

    // Fetch last 20 logs
    const start = Math.max(0, Number(logCount) - 20);
    for (let i = Number(logCount) - 1; i >= start; i--) {
      const log = await contract.getLog(i);
      logs.push({
        index: i,
        userId: log[0],
        action: log[1],
        riskScore: log[2],
        timestamp: Number(log[3])
      });
    }

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error("[API blockchain-logs] Failed to fetch on-chain logs:", error);
    return NextResponse.json(
      { success: false, logs: [], error: error?.message || "Failed to fetch on-chain security logs" }
    );
  }
}
