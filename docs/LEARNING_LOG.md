# Learning Log: Decentralized Multiplayer Dice Protocol

This log tracks Ethereum protocol concepts, architectural decisions, Foundry/Cast exercises, and verification milestones across all 12 development phases.

---

## Phase 1: Ethereum Fundamentals & Hardhat Setup
- **Status**: `Completed`
- **Concepts**:
  - Accounts: EOAs vs. Contract Accounts (nonce, balance, storage root, code hash)
  - Transactions, Gas (`gasPrice`, `baseFeePerGas`, `maxPriorityFeePerGas`), and Receipts
  - EVM execution model & deterministic state transitions
  - Hardhat Network (`npx hardhat node`) & JSON-RPC / Hardhat Console inspection
- **Environment Notes**:
  - Node.js `v22.21.1`, npm `11.18.0`, and Git `2.53.0` detected.
  - Using Hardhat + TypeScript (`@nomicfoundation/hardhat-toolbox`) for smart contract development, local EVM node, testing, and Sepolia verification.
- **Exercises & Observations**:
  - Initialized Hardhat (`hardhat@2.22.17`, `@nomicfoundation/hardhat-toolbox`, `@openzeppelin/contracts`) in `contracts/`.
  - Ran `npm run phase1` ([phase1-inspect.ts](file:///d:/Projects/Dice_game/contracts/scripts/phase1-inspect.ts)) on Hardhat Network (`chainId: 31337`):
    - Sent `1.5 ETH` from Alice (`0xf39Fd6...2266`) to Bob (`0x709979...79C8`).
    - Observed block number increment `0 -> 1`, Alice nonce `0 -> 1`.
    - Observed exact EOA transfer cost: `21000` gas × `1.875 gwei` = `0.000039375 ETH`.
    - Verified Alice balance delta equals `1.5 ETH + 0.000039375 ETH` (`9998.499960625 ETH`).
- **Conceptual Questions**:
  1. What is the difference between an Externally Owned Account (EOA) and a Smart Contract Account in terms of state fields and transaction initiation?
  2. Why does Ethereum charge gas for both computation and storage writes (`SSTORE`), and why is `SSTORE` significantly more expensive than `SLOAD` or memory operations?
  3. In Hardhat Network, what happens to pending state and block numbers when a transaction reverts?

---

## Phase 2: Single Multiplayer `DiceRoom` Contract
- **Status**: `In Progress`
- **Concepts**:
  - Solidity storage layout & packing (`uint8`, `address`, `bool`, `immutable`)
  - Explicit state machines with `enum`
  - Custom errors vs `require` strings (gas efficiency & ABI clarity)
  - `payable` functions, `msg.sender`, `msg.value`, and `address(this).balance`
  - Fixed-size arrays (`address[6]`) vs dynamic arrays (`address[]`)
- **Exercises & Observations**:
  - *Pending Phase 2 implementation and Hardhat + Viem unit tests.*
