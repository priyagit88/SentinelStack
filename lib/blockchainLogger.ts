import { ethers } from "ethers";
// Use a hardcoded ABI (not the gitignored Hardhat artifact) so `next build`
// works on Vercel, which never runs `hardhat compile`.
import { SecurityLogRegistryABI } from "./abis/SecurityLogRegistry";

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const operatorPrivateKey = process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY;
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

interface AnchorReceipt {
  transactionHash: string;
  // "pending" = tx submitted but we didn't block on confirmation (serverless-safe);
  // "confirmed" = mined, with block/gas details below.
  status: "pending" | "confirmed";
  blockNumber?: number;
  gasUsed?: string;
  from?: string;
  to?: string;
}

interface BlockchainLogRecord {
  userId: string;
  action: string;
  riskScore: string;
  timestamp: number;
}

/**
 * Signs and dispatches an automated transaction to the smart contract to anchor a forensic security log.
 * @param userId - The unique identifier of the user causing the alert.
 * @param action - The action/alert description.
 * @param riskScore - The computed risk level.
 * @returns The receipt data.
 */
export async function anchorSecurityLog(
  userId: string,
  action: string,
  riskScore: string,
  options: { waitForReceipt?: boolean } = {}
): Promise<AnchorReceipt> {
  try {
    if (!operatorPrivateKey) {
      throw new Error("BLOCKCHAIN_OPERATOR_PRIVATE_KEY environment variable is missing.");
    }
    if (!contractAddress) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is missing.");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(operatorPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, SecurityLogRegistryABI, wallet);

    console.log(`[Web3 Logger] Initiating write transaction to anchor: User=${userId}, Action=${action}, Risk=${riskScore}`);

    const tx = await contract.emitLog(userId, action, riskScore);
    console.log(`Transaction Hash: ${tx.hash}`);

    // Default: return as soon as the tx is broadcast. Awaiting tx.wait() on a
    // public testnet can take several seconds and may exceed a Vercel serverless
    // function's timeout — so confirmation is opt-in (admin forensic verify).
    if (!options.waitForReceipt) {
      return {
        transactionHash: tx.hash,
        status: "pending",
        from: wallet.address,
        to: contractAddress
      };
    }

    const receipt = await tx.wait();
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    return {
      transactionHash: tx.hash,
      status: "confirmed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      from: receipt.from,
      to: receipt.to
    };
  } catch (error) {
    console.error("[Web3 Logger] Error anchoring security log to blockchain:", error);
    throw error;
  }
}

/**
 * Gets the total count of on-chain security logs.
 * @returns The count of logs.
 */
export async function getBlockchainLogCount(): Promise<number> {
  try {
    if (!contractAddress) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is missing.");
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, SecurityLogRegistryABI, provider);
    const count = await contract.getLogCount();
    return Number(count);
  } catch (error) {
    console.error("[Web3 Logger] Error getting log count:", error);
    throw error;
  }
}

/**
 * Retrieves a log record from the blockchain registry by its index.
 * @param index - The index of the log.
 * @returns The log record details.
 */
export async function getBlockchainLog(index: number): Promise<BlockchainLogRecord> {
  try {
    if (!contractAddress) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is missing.");
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, SecurityLogRegistryABI, provider);
    const result = await contract.getLog(index);
    return {
      userId: result[0],
      action: result[1],
      riskScore: result[2],
      timestamp: Number(result[3])
    };
  } catch (error) {
    console.error(`[Web3 Logger] Error getting log at index ${index}:`, error);
    throw error;
  }
}
