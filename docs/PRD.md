# Product Requirements Document (PRD): Decentralized Multiplayer Dice Protocol

## 1. Overview

The **Decentralized Multiplayer Dice Protocol** is an original, trust-minimized multiplayer dice game built on Ethereum and deployed to the **Sepolia testnet**. Inspired by the [SpeedRunEthereum Dice Game](https://speedrunethereum.com/challenge/dice-game), this protocol extends the single-player/single-contract concept into a full multi-room, escrow-backed, verifiably fair multiplayer game with independent room lifecycles, pull-based payouts, and automatic expiration refunds.

> [!IMPORTANT]
> **Testnet Only**: This protocol is designed strictly for local Anvil development and Ethereum Sepolia testnet using testnet ETH.

---

## 2. Problem & Protocol Goals

On-chain games of chance face three classic Ethereum engineering challenges:
1. **Unpredictable, Unbiasable Randomness**: Block hashes (`blockhash` / `prevrandao`) can be influenced or exploited by validators/MEV searchers. The protocol solves this using **Chainlink VRF** (and a local mock for deterministic Hardhat Network testing).
2. **Isolated Escrow & Accounting**: Hosting multiple concurrent games in a single monolithic contract risks accounting bugs and cross-game contagion. The protocol isolates each game room into its own `DiceRoom` contract deployed via `DiceRoomFactory`.
3. **Liveness & Griefing Resistance**:
   - If a room never fills up, player funds must not be locked forever → **Time-bounded expiration + pull-based refunds**.
   - If a winner's address is a contract that reverts on ETH transfer, a push-based payout would brick settlement → **Pull-based withdrawals (`claimPrize` / `claimRefund`)**.

---

## 3. Game Rules

1. A player creates a room with a **fixed entry amount** (in testnet ETH) and a **duration** before expiration.
2. Up to **six distinct players** can join a room.
3. Every participant receives a **unique dice number** (`1` through `6`, assigned sequentially as players join).
4. Each participant deposits an **equal amount** of testnet ETH matching the room's fixed entry amount.
5. Once **six players join**, participation closes immediately.
6. The game **requests verifiable randomness** via `RandomnessManager` (backed by Chainlink VRF on Sepolia or the local mock on Anvil).
7. The dice result (`1`–`6`) **identifies the winning participant**.
8. The winner can **claim the pooled testnet ETH** (`6 * entryAmount`).
9. Players in **expired, unfilled rooms** (fewer than 6 players after the deadline) can **claim full refunds** of their deposit.
10. **Multiple rooms** operate completely independently.

---

## 4. User Flows

### 4.1 Room Creator
- Connects wallet (RainbowKit) and verifies network (Anvil / Sepolia).
- Configures `entryAmount` (> 0) and `duration` (within protocol min/max bounds).
- Submits `createRoom` transaction on `DiceRoomFactory`.
- Optionally joins the room as Player 1.

### 4.2 Joining Player
- Discovers open rooms in the Lobby with live player count (`N/6`), entry fee, and countdown timer.
- Enters a room and clicks **Join Room**, sending exact `entryAmount` ETH.
- Receives a unique dice number (`1`–`6`) reflected in the UI.
- If they are the 6th player, the room transitions to `Drawing` and triggers the randomness request.

### 4.3 Settlement & Prize Claim
- Chainlink VRF fulfills the randomness request via `RandomnessManager` → `DiceRoom`.
- The room computes `winningDice = (randomWord % 6) + 1`, records the winner, and transitions to `Settled`.
- The UI animates the dice roll and highlights the winning player.
- The winner clicks **Claim Prize** to withdraw the full pool (`6 * entryAmount`).

### 4.4 Room Expiration & Refund
- If the room deadline passes with `< 6` players, anyone can trigger expiration (or it is evaluated lazily on refund).
- The room transitions to `Expired`.
- Each deposited player clicks **Claim Refund** to withdraw their exact `entryAmount`.

---

## 5. Functional Requirements

### 5.1 Smart Contracts
| Component | Responsibility |
| :--- | :--- |
| `DiceRoomFactory` | Deploys independent `DiceRoom` instances, maintains room registry, emits discovery events, holds protocol configuration (`RandomnessManager` address, min/max duration, min entry fee). |
| `DiceRoom` | Manages a single 6-player game: player deposits, unique dice slot assignment (`1`–`6`), explicit state machine (`Open`, `Drawing`, `Settled`, `Expired`), randomness request & callback handling, pull-based prize claim and refund withdrawals. |
| `RandomnessManager` | Coordinates VRF requests on behalf of registered `DiceRoom` contracts, maps `requestId -> roomAddress`, authenticates VRF callbacks, and forwards the random word to the target `DiceRoom`. |
| Local Randomness Mock | Simulates VRF Coordinator behavior in Hardhat tests and local Hardhat Network nodes for deterministic testing. |

### 5.2 Frontend (Next.js + TypeScript + Wagmi + Viem + RainbowKit + Tailwind CSS)
- **Wallet Connection & Network Detection**: RainbowKit modal, automatic detection of Hardhat Local (`31337`) and Sepolia (`11155111`) with wrong-network prompt.
- **Room Discovery & Lobby**: Live list of rooms (Open, Drawing, Settled, Expired), filtering, entry fee, pool size, and player count.
- **Room Creation**: Form with validation for entry amount and room duration.
- **Live Room View (`/room/[id]`)**:
  - 6-seat player position board showing occupied dice numbers (`1`–`6`) and player addresses.
  - Real-time prize pool display and countdown timer.
  - Interactive dice animation on settlement.
  - Transaction status feedback (pending, confirming, confirmed, error).
  - Context-aware action buttons: Join, Expire/Refund, Claim Prize.
- **Game History**: Past settled and expired rooms with winners, dice results, and payout status.
- **Responsive Design**: Original, clean UI across desktop and mobile viewports.

---

## 6. Engineering & Security Requirements

- **Explicit Room State Machine**: `Open` → `Drawing` → `Settled`, or `Open` → `Expired`. Invalid state transitions revert with custom errors.
- **Independent Room Accounting**: Each `DiceRoom` holds only its own players' ETH.
- **Authenticated Randomness Callbacks**: Only `RandomnessManager` can call `fulfillRandomness` on `DiceRoom`; only VRF Coordinator can call `rawFulfillRandomWords` on `RandomnessManager`.
- **Request-to-Room Correlation**: `RandomnessManager` tracks `mapping(uint256 => address) public requestToRoom` and prevents duplicate/stale fulfillment.
- **Duplicate Participation & Capacity Enforcement**: A player address cannot join the same room twice; maximum 6 players enforced.
- **Duplicate Settlement & Claim Prevention**: `prizeClaimed` flag and per-player `refunded` / `contribution` zeroing before external ETH transfer (CEI + `ReentrancyGuard`).
- **Custom Errors & Events**: Gas-efficient custom errors and indexed events for all state transitions and financial movements.
- **Testing & Gas Reporting**: Unit, integration, property/fuzz, and financial invariant tests with Hardhat (`npx hardhat test` + `hardhat-gas-reporter`).

---

## 7. Development Phases & Milestones

| Phase | Focus |
| :--- | :--- |
| **Phase 1** | Ethereum fundamentals, Hardhat & local node setup, RPC inspection |
| **Phase 2** | Single multiplayer `DiceRoom` contract skeleton & state machine |
| **Phase 3** | Player deposits, escrow, duplicate/capacity guards, and prize claims |
| **Phase 4** | Room expiration, deadlines, and pull-based refunds |
| **Phase 5** | Verifiable randomness integration (`RandomnessManager` + VRF + Local Mock) |
| **Phase 6** | `DiceRoomFactory` and independent multi-room discovery |
| **Phase 7** | Comprehensive unit, integration, fuzz, and financial invariant tests |
| **Phase 8** | Original multiplayer frontend (Next.js + Tailwind CSS) |
| **Phase 9** | Wallet integration (Wagmi/Viem/RainbowKit) & live room synchronization |
| **Phase 10** | Local end-to-end testing with 6 Hardhat accounts |
| **Phase 11** | Sepolia deployment, Etherscan verification, and Chainlink VRF funding |
| **Phase 12** | Vercel frontend deployment, CI/CD (GitHub Actions), and public testnet verification |

---

## 8. Final Acceptance Criteria

1. **Six separate wallet accounts** join the same `DiceRoom`, each contributing equal testnet ETH.
2. The room closes at 6 players, requests verifiable randomness, receives the VRF result, and identifies the winning dice number (`1`–`6`).
3. The winner successfully claims the full pooled testnet ETH (`6 * entryAmount`).
4. **Multiple independent rooms** operate concurrently without interfering with each other's state or balances.
5. An **expired, unfilled room** allows all participating players to claim full refunds of their deposits.
6. All unit, integration, fuzz, and invariant tests pass with zero skipped assertions.
7. Contracts are deployed and verified on **Sepolia**, and the frontend is live on **Vercel**.
