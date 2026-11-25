# System Architecture: Decentralized Multiplayer Dice Protocol

## 1. High-Level Architecture

The protocol separates **room orchestration**, **escrow/game logic**, and **verifiable randomness** into three distinct contract layers, paired with a Next.js + Wagmi/Viem frontend.

```mermaid
flowchart TB
    subgraph Frontend["Multiplayer Frontend (Next.js + Wagmi + Viem + RainbowKit)"]
        UI["Lobby / Room UI / History"]
    end

    subgraph Protocol["Ethereum Smart Contracts"]
        Factory["DiceRoomFactory.sol"]
        Room1["DiceRoom #1 (Escrow & State)"]
        Room2["DiceRoom #2 (Escrow & State)"]
        RM["RandomnessManager.sol"]
    end

    subgraph Oracle["Verifiable Randomness"]
        VRF["Chainlink VRF v2.5 Coordinator (Sepolia) / Local Mock (Hardhat)"]
    end

    UI -->|"createRoom()"| Factory
    UI -->|"getRooms() / Events"| Factory
    UI -->|"join() / claimPrize() / claimRefund()"| Room1
    UI -->|"join() / claimPrize() / claimRefund()"| Room2

    Factory -->|"deploys & registers"| Room1
    Factory -->|"deploys & registers"| Room2

    Room1 -->|"requestRandomness()"| RM
    Room2 -->|"requestRandomness()"| RM
    RM -->|"requestRandomWords()"| VRF
    VRF -->|"rawFulfillRandomWords(requestId, randomWords)"| RM
    RM -->|"fulfillRandomness(requestId, randomWord)"| Room1
    RM -->|"fulfillRandomness(requestId, randomWord)"| Room2
```

> [!NOTE]
> **Deployment Strategy**: We start with standard `new DiceRoom(...)` deployments from `DiceRoomFactory` for clarity and straightforward verification. Minimal proxies (EIP-1167 `Clones`) can be explored as an optional gas optimization after the core system is tested and working.

---

## 2. Core Smart Contracts

### 2.1 `DiceRoomFactory.sol`
- **Role**: Entry point for room creation and discovery.
- **State**:
  - `address[] public rooms` — ordered list of all deployed `DiceRoom` addresses.
  - `mapping(address => bool) public isRegisteredRoom` — O(1) verification that a room was created by this factory.
  - `RandomnessManager public immutable randomnessManager` — shared randomness router.
- **Key Functions**:
  - `createRoom(uint256 entryAmount, uint256 duration) external returns (address room)`
  - `getRoomsCount() external view returns (uint256)`
  - `getRooms(uint256 offset, uint256 limit) external view returns (address[] memory)`

### 2.2 `DiceRoom.sol`
- **Role**: Self-contained escrow and state machine for one 6-player dice game.
- **Key State**:
  - `uint256 public immutable entryAmount`
  - `uint256 public immutable deadline`
  - `RoomState public state` (`Open`, `Drawing`, `Settled`, `Expired`)
  - `address[6] public players` (index `0..5` corresponds to dice numbers `1..6`)
  - `uint8 public playerCount`
  - `mapping(address => bool) public hasJoined`
  - `uint8 public winningDice` (`1..6`, `0` if unset)
  - `address public winner`
  - `bool public prizeClaimed`
  - `mapping(address => bool) public refundClaimed`
- **Access Control**:
  - `join()`: Public payable while `state == Open` and `block.timestamp < deadline`, exact `msg.value == entryAmount`, `!hasJoined[msg.sender]`, `playerCount < 6`.
  - `fulfillRandomness(uint256 requestId, uint256 randomWord)`: Restricted to `randomnessManager`.
  - `claimPrize()`: Restricted to `winner` when `state == Settled && !prizeClaimed`.
  - `expireRoom()` / `claimRefund()`: Allowed when `block.timestamp >= deadline` and `state == Open` (transitions to `Expired`), and `hasJoined[msg.sender] && !refundClaimed[msg.sender]`.

### 2.3 `RandomnessManager.sol`
- **Role**: Bridges `DiceRoom` instances to Chainlink VRF without requiring each room to hold its own VRF subscription.
- **Why a Separate Manager?**
  - Chainlink VRF requires funding a subscription and authorizing consumer contracts. Having `DiceRoomFactory` deploy a new `DiceRoom` per game means new rooms cannot be pre-authorized on a VRF subscription without manual or factory-admin intervention.
  - Instead, **only `RandomnessManager`** is registered as the VRF consumer. `DiceRoomFactory` registers each newly created `DiceRoom` with `RandomnessManager` (`registerRoom(address room)`).
- **Request-to-Room Correlation**:
  - `mapping(uint256 => address) public requestToRoom`
  - `mapping(address => bool) public authorizedRooms`

---

## 3. Room State Machine

```mermaid
stateDiagram-v2
    [*] --> Open : Factory deploys DiceRoom

    Open --> Drawing : 6th player joins (playerCount == 6 && block.timestamp < deadline)
    Open --> Expired : block.timestamp >= deadline && playerCount < 6

    Drawing --> Settled : RandomnessManager delivers randomWord (winningDice = randomWord % 6 + 1)

    Settled --> [*] : Winner calls claimPrize()
    Expired --> [*] : Players call claimRefund()
```

---

## 4. End-to-End Sequence Flows

### 4.1 Happy Path: 6 Players Join, VRF Settles, Winner Claims

```mermaid
sequenceDiagram
    actor P1 as Player 1..5
    actor P6 as Player 6
    participant Factory as DiceRoomFactory
    participant Room as DiceRoom
    participant RM as RandomnessManager
    participant VRF as VRF Coordinator

    P1->>Factory: createRoom(entryAmount, duration)
    Factory->>Room: new DiceRoom(...)
    Factory->>RM: registerRoom(room)
    Factory-->>P1: RoomCreated(room, ...)

    P1->>Room: join() + entryAmount ETH (Players 1..5)
    Room-->>P1: PlayerJoined(player, diceNumber)

    P6->>Room: join() + entryAmount ETH (6th player)
    Room->>Room: state = Drawing
    Room->>RM: requestRandomness()
    RM->>VRF: requestRandomWords(...)
    VRF-->>RM: requestId
    RM->>RM: requestToRoom[requestId] = room

    VRF-->>RM: rawFulfillRandomWords(requestId, randomWords)
    RM->>Room: fulfillRandomness(requestId, randomWords[0])
    Room->>Room: winningDice = (randomWord % 6) + 1
    Room->>Room: winner = players[winningDice - 1], state = Settled

    Note over Room: Winner calls claimPrize() (Pull Pattern)
    P6->>Room: claimPrize()
    Room->>Room: prizeClaimed = true
    Room-->>P6: transfers 6 * entryAmount ETH
```

### 4.2 Expiration & Refund Path

```mermaid
sequenceDiagram
    actor P as Participating Players
    participant Room as DiceRoom

    Note over Room: Deadline passes with playerCount < 6
    P->>Room: claimRefund() (or expireRoom())
    Room->>Room: if state == Open && block.timestamp >= deadline -> state = Expired
    Room->>Room: require(hasJoined[msg.sender] && !refundClaimed[msg.sender])
    Room->>Room: refundClaimed[msg.sender] = true
    Room-->>P: transfers entryAmount ETH
```

---

## 5. Security Model & Financial Invariants

1. **Pull-over-Push Withdrawals**: Neither `fulfillRandomness` nor `expireRoom` sends ETH. Winners and refund claimants pull their own funds via `claimPrize()` and `claimRefund()`, protected by Checks-Effects-Interactions (CEI) and OpenZeppelin `ReentrancyGuard`.
2. **Solvency Invariant**: At all times:
   - In `Open` or `Drawing`: `address(room).balance == playerCount * entryAmount`
   - In `Settled`: `address(room).balance == (prizeClaimed ? 0 : 6 * entryAmount)`
   - In `Expired`: `address(room).balance == (playerCount - refundedCount) * entryAmount`
3. **Mutual Exclusion**: A room in `Settled` can never transition to `Expired`, and vice versa.
4. **No Stale VRF Fulfillment**: `RandomnessManager` clears `requestToRoom[requestId]` upon fulfillment and `DiceRoom` checks `state == Drawing` before settling.

---

## 6. Repository Layout

```text
Dice_game/
├── contracts/          # Hardhat workspace (Solidity, TypeScript tests, deploy scripts)
├── frontend/           # Next.js + TypeScript + Wagmi/Viem/RainbowKit
├── deployments/        # Local & Sepolia deployment artifacts (addresses, ABIs)
├── docs/               # PRD, Architecture, Learning Log, Test Report
├── .github/workflows/  # CI for Hardhat tests & frontend build
├── .env.example        # Environment variable template
└── README.md           # Project overview & quickstart
```
