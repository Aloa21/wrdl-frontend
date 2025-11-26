const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MON");

  // Existing WRDLE token address
  const WRDLE_TOKEN = "0xa1d2c0ea74dc49588078D234B68d5Ca527f91c67";

  // Owner address (who can update prizes and emergency withdraw)
  const OWNER = deployer.address;

  console.log("\n--- Deploying WordleRoyaleFree ---");
  console.log("WRDLE Token:", WRDLE_TOKEN);
  console.log("Owner:", OWNER);

  const WordleRoyaleFree = await hre.ethers.getContractFactory("WordleRoyaleFree");
  const game = await WordleRoyaleFree.deploy(WRDLE_TOKEN, OWNER);
  await game.waitForDeployment();

  const gameAddress = await game.getAddress();
  console.log("WordleRoyaleFree deployed to:", gameAddress);

  // Check if we need to fund the prize pool
  console.log("\n--- Prize Pool Info ---");
  const prizePool = await game.getPrizePool();
  console.log("Current prize pool:", hre.ethers.formatEther(prizePool), "WRDLE");

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                    DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("WordleRoyaleFree:", gameAddress);
  console.log("WRDLE Token:     ", WRDLE_TOKEN);
  console.log("Owner:           ", OWNER);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\nFree-to-Play Model:");
  console.log("- Players join for FREE (no entry fee)");
  console.log("- Winners receive WRDLE tokens from prize pool");
  console.log("- Base prize: 10 WRDLE per win");
  console.log("- Perfect game (1 guess): +100 WRDLE bonus");
  console.log("- First win ever: +50 WRDLE bonus");
  console.log("- Milestone bonuses: 10/50/100 wins");
  console.log("- Streak multipliers: up to 3x");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n⚠️  IMPORTANT: Fund the prize pool!");
  console.log("Call fundPrizePool(amount) or transfer WRDLE tokens to:", gameAddress);
  console.log("\nExample with 10,000 WRDLE:");
  console.log(`npx hardhat run --network monad scripts/fund-prize-pool.js`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
