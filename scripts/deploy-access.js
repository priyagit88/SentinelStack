const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  console.log("Deploying SentinelAccess contract...");

  // Default admin addresses (Hardhat accounts 0-2 for local dev)
  const initialAdmins = [
    "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Hardhat Account #0
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat Account #1
  ];

  // Allow override via env var (comma-separated hex addresses)
  if (process.env.INITIAL_ADMIN_ADDRESSES) {
    const envAdmins = process.env.INITIAL_ADMIN_ADDRESSES.split(",")
      .map(a => a.trim())
      .filter(a => a.startsWith("0x"));
    if (envAdmins.length > 0) {
      initialAdmins.length = 0;
      initialAdmins.push(...envAdmins);
    }
  }

  const artifactPath = path.join(__dirname, "../artifacts/contracts/SentinelAccess.sol/SentinelAccess.json");
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found! Please compile the smart contract first using: npx hardhat compile");
    process.exit(1);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const privateKey = process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  console.log(`Connecting to JSON-RPC network at: ${rpcUrl}`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const sentinelAccess = await factory.deploy(initialAdmins);
  await sentinelAccess.waitForDeployment();

  const deployedAddress = await sentinelAccess.getAddress();
  console.log(`SentinelAccess deployed to: ${deployedAddress}`);
  console.log(`Initial admins: ${initialAdmins.join(", ")}`);
  console.log("");
  console.log("Add to .env.local:");
  console.log(`NEXT_PUBLIC_SENTINEL_ACCESS_CONTRACT=${deployedAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

