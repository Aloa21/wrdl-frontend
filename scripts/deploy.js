const hre = require("hardhat");

async function main() {
  console.log("Deploying Royale contract to Monad Mainnet...\n");

  const signers = await hre.ethers.getSigners();

  if (signers.length === 0) {
    console.error("Error: No signers available. Please set PRIVATE_KEY in your .env file");
    console.log("\nCreate a .env file with:");
    console.log("PRIVATE_KEY=your_private_key_here");
    process.exit(1);
  }

  const deployer = signers[0];
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "MON\n");

  if (balance === 0n) {
    console.error("Error: Account has no MON balance. Please fund the account.");
    process.exit(1);
  }

  // Deploy Royale contract
  console.log("Deploying Royale contract...");
  const Royale = await hre.ethers.getContractFactory("Royale");
  const royale = await Royale.deploy();

  await royale.waitForDeployment();
  const royaleAddress = await royale.getAddress();

  console.log("\n✅ Royale deployed to:", royaleAddress);
  console.log("\n📋 Contract Details:");
  console.log("   Network: Monad Mainnet (Chain ID: 143)");
  console.log("   Permit2:", "0x000000000022D473030F116dDEE9F6B43aC78BA3");
  console.log("   Domain Name: Royale");
  console.log("   Domain Version: 1");

  // Get domain separator for verification
  const domainSeparator = await royale.domainSeparator();
  console.log("   Domain Separator:", domainSeparator);

  console.log("\n🔗 View on Explorer:");
  console.log(`   https://monadscan.com/address/${royaleAddress}`);

  return royaleAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
