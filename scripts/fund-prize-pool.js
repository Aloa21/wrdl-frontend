const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Funding prize pool with:", deployer.address);

  // Contract addresses
  const GAME_ADDRESS = "0xef70520518364652ed718869cfAd1E1a0499f603";
  const WRDLE_TOKEN = "0xa1d2c0ea74dc49588078D234B68d5Ca527f91c67";

  // Amount to fund (10,000 WRDLE)
  const FUND_AMOUNT = hre.ethers.parseEther("10000");

  // Get token contract
  const token = await hre.ethers.getContractAt(
    ["function balanceOf(address) view returns (uint256)",
     "function approve(address, uint256) returns (bool)",
     "function allowance(address, address) view returns (uint256)"],
    WRDLE_TOKEN
  );

  // Get game contract
  const game = await hre.ethers.getContractAt(
    ["function fundPrizePool(uint256)", "function getPrizePool() view returns (uint256)"],
    GAME_ADDRESS
  );

  // Check current balance
  const balance = await token.balanceOf(deployer.address);
  console.log("Your WRDLE balance:", hre.ethers.formatEther(balance), "WRDLE");

  if (balance < FUND_AMOUNT) {
    console.log("Insufficient WRDLE balance. Need", hre.ethers.formatEther(FUND_AMOUNT), "WRDLE");
    return;
  }

  // Check current prize pool
  const currentPool = await game.getPrizePool();
  console.log("Current prize pool:", hre.ethers.formatEther(currentPool), "WRDLE");

  // Approve spending
  console.log("\nApproving WRDLE spending...");
  const approveTx = await token.approve(GAME_ADDRESS, FUND_AMOUNT);
  await approveTx.wait();
  console.log("Approved!");

  // Fund prize pool
  console.log("Funding prize pool with", hre.ethers.formatEther(FUND_AMOUNT), "WRDLE...");
  const fundTx = await game.fundPrizePool(FUND_AMOUNT);
  await fundTx.wait();
  console.log("Funded!");

  // Check new prize pool
  const newPool = await game.getPrizePool();
  console.log("\nNew prize pool:", hre.ethers.formatEther(newPool), "WRDLE");
  console.log("Successfully funded the prize pool!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
