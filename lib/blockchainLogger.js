import { ethers } from "ethers";
import contractArtifact from "../artifacts/contracts/SecurityLogRegistry.sol/SecurityLogRegistry.json";

const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const operatorPrivateKey = process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY;
const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

/**
 * Signs and dispatches an automated transaction to the smart contract to anchor a forensic security log.
 * @param {string} userId - The unique identifier of the user causing the alert.
 * @param {string} action - The action/alert description.
 * @param {string} riskScore - The computed risk level.
 * @returns {Promise<object>} The receipt data.
 */
export async function anchorSecurityLog(userId, action, riskScore) {
  try {
    if (!operatorPrivateKey) {
      throw new Error("BLOCKCHAIN_OPERATOR_PRIVATE_KEY environment variable is missing.");
    }
    if (!contractAddress) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is missing.");
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(operatorPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, wallet);

    console.log(`[Web3 Logger] Initiating write transaction to anchor: User=${userId}, Action=${action}, Risk=${riskScore}`);

    const tx = await contract.emitLog(userId, action, riskScore);
    const receipt = await tx.wait();

    // Log to Next.js terminal console.logs exactly as requested
    console.log(`Transaction Hash: ${tx.hash}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);

    return {
      transactionHash: tx.hash,
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
 * @returns {Promise<number>}
 */
export async function getBlockchainLogCount() {
  try {
    if (!contractAddress) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is missing.");
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);
    const count = await contract.getLogCount();
    return Number(count);
  } catch (error) {
    console.error("[Web3 Logger] Error getting log count:", error);
    throw error;
  }
}

/**
 * Retrieves a log record from the blockchain registry by its index.
 * @param {number} index
 * @returns {Promise<object>}
 */
export async function getBlockchainLog(index) {
  try {
    if (!contractAddress) {
      throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS environment variable is missing.");
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(contractAddress, contractArtifact.abi, provider);
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
