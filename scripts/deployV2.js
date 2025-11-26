const hre = require("hardhat");

async function main() {
  console.log("Deploying WordleRoyale V2 with Token Rewards to Monad Mainnet...\n");

  const signers = await hre.ethers.getSigners();

  if (signers.length === 0) {
    console.error("Error: No signers available. Set PRIVATE_KEY in .env");
    process.exit(1);
  }

  const deployer = signers[0];
  console.log("Deploying with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "MON\n");

  // 1. Deploy WordleToken
  console.log("1. Deploying WordleToken (WRDLE)...");
  const WordleToken = await hre.ethers.getContractFactory("WordleToken");
  const wordleToken = await WordleToken.deploy();
  await wordleToken.waitForDeployment();
  const tokenAddress = await wordleToken.getAddress();
  console.log("   WordleToken deployed to:", tokenAddress);

  // 2. Deploy WordleRoyaleV2
  console.log("\n2. Deploying WordleRoyaleV2...");
  const WordleRoyaleV2 = await hre.ethers.getContractFactory("WordleRoyaleV2");
  const wordleRoyaleV2 = await WordleRoyaleV2.deploy(tokenAddress);
  await wordleRoyaleV2.waitForDeployment();
  const gameAddress = await wordleRoyaleV2.getAddress();
  console.log("   WordleRoyaleV2 deployed to:", gameAddress);

  // 3. Set game contract as minter
  console.log("\n3. Setting WordleRoyaleV2 as token minter...");
  const tx = await wordleToken.addMinter(gameAddress);
  await tx.wait();
  console.log("   Minter added!");

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log("   WordleToken (WRDLE):", tokenAddress);
  console.log("   WordleRoyaleV2:     ", gameAddress);
  console.log("\n📊 Token Details:");
  console.log("   Name: Wordle Token");
  console.log("   Symbol: WRDLE");
  console.log("   Initial Supply: 10,000,000 WRDLE (to deployer)");
  console.log("   Max Supply: 100,000,000 WRDLE");
  console.log("\n🎮 Reward Structure:");
  console.log("   Base Win Reward: 10 WRDLE");
  console.log("   Streak Multipliers: 1.5x (day 2), 2x (day 3), 3x (day 7+)");
  console.log("   Perfect Game (1 guess): +100 WRDLE");
  console.log("   First Win: +50 WRDLE");
  console.log("   10 Wins: +200 WRDLE");
  console.log("   50 Wins: +1,000 WRDLE");
  console.log("   100 Wins: +5,000 WRDLE");
  console.log("\n🔗 Explorer Links:");
  console.log(`   Token: https://monadscan.com/address/${tokenAddress}`);
  console.log(`   Game:  https://monadscan.com/address/${gameAddress}`);
  console.log("\n" + "═".repeat(60));

  return { tokenAddress, gameAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
