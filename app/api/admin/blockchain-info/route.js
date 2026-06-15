import { NextResponse } from "next/server";
import { ethers } from "ethers";

export const runtime = "nodejs";

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const operatorPrivateKey = process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY;
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

/**
 * GET /api/admin/blockchain-info
 * Returns metadata about the connected blockchain network and recent blocks.
 */
export async function GET() {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
      staticNetwork: true
    });

    // Check if network is reachable by calling getBlockNumber with a timeout
    const blockNumberPromise = provider.getBlockNumber();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout connecting to RPC")), 2500)
    );
    const blockNumber = await Promise.race([blockNumberPromise, timeoutPromise]);

    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    let gasPriceEth = "0";
    try {
      const feeData = await provider.getFeeData();
      if (feeData.gasPrice) {
        gasPriceEth = ethers.formatUnits(feeData.gasPrice, "gwei");
      }
    } catch (gErr) {
      console.warn("Could not fetch gas price:", gErr);
    }

    let operatorAddress = "Unknown";
    let operatorBalance = "0.0";
    if (operatorPrivateKey) {
      try {
        const wallet = new ethers.Wallet(operatorPrivateKey, provider);
        operatorAddress = wallet.address;
        const balance = await provider.getBalance(wallet.address);
        operatorBalance = ethers.formatEther(balance);
      } catch (wErr) {
        console.error("Failed to query operator wallet details:", wErr);
      }
    }

    let isContractDeployed = false;
    if (contractAddress) {
      try {
        const code = await provider.getCode(contractAddress);
        isContractDeployed = code !== "0x" && code !== "";
      } catch (cErr) {
        console.error("Failed to verify contract code presence:", cErr);
      }
    }

    // Fetch recent block headers (last 5 blocks)
    const recentBlocks = [];
    const limit = 5;
    const start = blockNumber;
    const end = Math.max(0, blockNumber - limit + 1);

    for (let i = start; i >= end; i--) {
      try {
        const block = await provider.getBlock(i);
        if (block) {
          recentBlocks.push({
            number: block.number,
            hash: block.hash,
            parentHash: block.parentHash,
            timestamp: block.timestamp,
            gasUsed: block.gasUsed.toString(),
            txCount: block.transactions.length
          });
        }
      } catch (bErr) {
        console.error(`Error fetching block details for height ${i}:`, bErr);
      }
    }

    return NextResponse.json({
      success: true,
      network: {
        rpcUrl,
        chainId,
        blockNumber,
        gasPriceGwei: gasPriceEth,
        operatorAddress,
        operatorBalanceEth: parseFloat(operatorBalance).toFixed(4),
        contractAddress,
        isContractDeployed
      },
      recentBlocks
    });

  } catch (error) {
    console.error("[API blockchain-info] Failed to query blockchain status:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to connect to local blockchain network",
      isOffline: true,
      setupInstructions: {
        command1: "npx hardhat node",
        command2: "npx hardhat run scripts/deploy.js --network localhost",
        envVar: `NEXT_PUBLIC_CONTRACT_ADDRESS=<deployed_address>`
      }
    });
  }
}
