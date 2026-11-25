import hre from "hardhat";
import { formatEther, formatGwei, parseEther } from "viem";

async function main() {
  const publicClient = await hre.viem.getPublicClient();
  const [alice, bob] = await hre.viem.getWalletClients();

  const chainId = await publicClient.getChainId();
  const blockBefore = await publicClient.getBlockNumber();

  console.log("=== Phase 1: Ethereum Fundamentals Inspection (Hardhat + Viem) ===");
  console.log(`Chain ID: ${chainId}`);
  console.log(`Block Number (before tx): ${blockBefore}`);
  console.log(`Alice: ${alice.account.address}`);
  console.log(`Bob:   ${bob.account.address}`);

  const aliceBalBefore = await publicClient.getBalance({ address: alice.account.address });
  const bobBalBefore = await publicClient.getBalance({ address: bob.account.address });
  const aliceNonceBefore = await publicClient.getTransactionCount({ address: alice.account.address });

  console.log(`\nBefore Transfer:`);
  console.log(`  Alice balance: ${formatEther(aliceBalBefore)} ETH (nonce: ${aliceNonceBefore})`);
  console.log(`  Bob balance:   ${formatEther(bobBalBefore)} ETH`);

  const sendAmount = parseEther("1.5");
  const hash = await alice.sendTransaction({
    to: bob.account.address,
    value: sendAmount,
  });

  console.log(`\nTransaction Sent: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const gasUsed = receipt.gasUsed;
  const effectiveGasPrice = receipt.effectiveGasPrice;
  const gasCostWei = gasUsed * effectiveGasPrice;

  console.log(`\nTransaction Receipt:`);
  console.log(`  Status:              ${receipt.status === "success" ? "SUCCESS" : "REVERTED"}`);
  console.log(`  Block Number:        ${receipt.blockNumber}`);
  console.log(`  Gas Used:            ${gasUsed.toString()} units`);
  console.log(`  Effective Gas Price: ${formatGwei(effectiveGasPrice)} gwei`);
  console.log(`  Total Gas Fee:       ${formatEther(gasCostWei)} ETH`);

  const aliceBalAfter = await publicClient.getBalance({ address: alice.account.address });
  const bobBalAfter = await publicClient.getBalance({ address: bob.account.address });
  const aliceNonceAfter = await publicClient.getTransactionCount({ address: alice.account.address });

  console.log(`\nAfter Transfer:`);
  console.log(`  Alice balance: ${formatEther(aliceBalAfter)} ETH (nonce: ${aliceNonceAfter})`);
  console.log(`  Bob balance:   ${formatEther(bobBalAfter)} ETH`);

  const expectedAliceAfter = aliceBalBefore - sendAmount - gasCostWei;
  if (aliceBalAfter !== expectedAliceAfter) {
    throw new Error("Alice balance mismatch!");
  }
  console.log(`\nVerified: Alice delta == value (1.5 ETH) + gas fee.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
