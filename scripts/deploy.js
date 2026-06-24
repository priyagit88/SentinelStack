const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  const artifactPath = path.join(__dirname, "../artifacts/contracts/SecurityLogRegistry.sol/SecurityLogRegistry.json");
  
  if (!fs.existsSync(artifactPath)) {
    console.error("Artifact not found! Please compile the smart contract first using: npx hardhat compile");
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  // Retrieve configuration from environment variables or use local defaults
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const privateKey = process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

  console.log(`Connecting to JSON-RPC network at: ${rpcUrl}`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log("Initializing operator wallet...");
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Operator account address: ${wallet.address}`);

  console.log("Deploying SecurityLogRegistry smart contract...");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();

  console.log("Waiting for transaction confirmation...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`Contract Address: ${address}`);

  console.log("\nSeeding initial forensic logs to the blockchain registry...");

  // Let ethers derive the nonce per tx (awaiting each sequentially). Manual
  // nonce bookkeeping collided with the deploy tx and caused REPLACEMENT_UNDERPRICED.
  const seeds = [
    ["user_001", "EXPIRED_SESSION_REPLAY", "MEDIUM"],
    ["user_002", "SQL_INJECTION_SQLI", "CRITICAL"],
    ["user_003", "API_SECRET_LEAK", "CRITICAL"],
    ["user_004", "PRIVILEGE_ESCALATION", "HIGH"]
  ];
  for (let i = 0; i < seeds.length; i++) {
    const [user, action, risk] = seeds[i];
    const tx = await contract.emitLog(user, action, risk);
    await tx.wait();
    console.log(`Seeded Log #${i}: ${user} (${action}, ${risk})`);
  }

  console.log("Seeding complete!\n");

  console.log(`\n======================================================`);
  console.log(`SUCCESS: SecurityLogRegistry deployed successfully!`);
  console.log(`Contract Address: ${address}`);
  console.log(`======================================================\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
