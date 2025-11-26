const hre = require("hardhat");

async function main() {
  console.log("Deploying WordleRoyale to Monad Mainnet...\n");

  const signers = await hre.ethers.getSigners();

  if (signers.length === 0) {
    console.error("Error: No signers available. Set PRIVATE_KEY in .env");
    process.exit(1);
  }

  const deployer = signers[0];
  console.log("Deploying with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "MON\n");

  // Deploy WordleRoyale
  console.log("Deploying WordleRoyale...");
  const WordleRoyale = await hre.ethers.getContractFactory("WordleRoyale");
  const wordleRoyale = await WordleRoyale.deploy();

  await wordleRoyale.waitForDeployment();
  const contractAddress = await wordleRoyale.getAddress();

  console.log("\n✅ WordleRoyale deployed to:", contractAddress);
  console.log("\n📋 Contract Details:");
  console.log("   Network: Monad Mainnet (Chain ID: 143)");
  console.log("   WMON:", "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A");
  console.log("   Domain Name: WordleRoyale");
  console.log("   Domain Version: 1");

  const domainSeparator = await wordleRoyale.domainSeparator();
  console.log("   Domain Separator:", domainSeparator);

  console.log("\n🔗 View on Explorer:");
  console.log(`   https://monadscan.com/address/${contractAddress}`);

  console.log("\n📝 How it works:");
  console.log("   1. Players pay entry fee in MON");
  console.log("   2. Contract wraps MON → WMON automatically");
  console.log("   3. WMON accumulates in prize pool");
  console.log("   4. Winner receives WMON prize");

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
