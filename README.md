# Decentralized Multiplayer Dice Protocol

An original, trust-minimized multiplayer dice game built on Ethereum (Sepolia testnet) with Hardhat, Viem, Chainlink VRF, Next.js, Wagmi, and RainbowKit.

## Repository Structure

```text
Dice_game/
├── contracts/          # Hardhat + Viem workspace (Solidity in src/, tests in test/, scripts/)
├── frontend/           # Next.js + TypeScript + Wagmi + Viem + RainbowKit + Tailwind CSS
├── deployments/        # Local & Sepolia deployment artifacts
├── docs/               # PRD, Architecture, Learning Log, Test Report
├── .github/workflows/  # CI workflows
├── .env.example        # Environment variable template
└── README.md
```

## Documentation

- [Product Requirements Document](docs/PRD.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Learning Log](docs/LEARNING_LOG.md)
- [Test Report](docs/TEST_REPORT.md)

## Quickstart (Contracts)

```bash
cd contracts
npm install
npx hardhat compile
npm run phase1
```
