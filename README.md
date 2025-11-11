# LendForge v6.1.0

**Multi-Collateral DeFi Lending Protocol with Automated Liquidations**

---

## Overview

LendForge is a complete DeFi lending platform enabling users to:
- **Borrow ETH** against multi-asset collateral (ETH, USDC, DAI)
- **Dual-source oracle** pricing with automatic fallback (Chainlink + Uniswap V3 TWAP)
- **Automated liquidations** via Python bot with profitability calculations
- **Real-time analytics** via The Graph subgraph + Next.js dashboard

**Stack:** Solidity/Foundry → TheGraph → Next.js 15 + Python Bot

---

## Project Status

**Version:** v6.1.0 (Iteration 1 Complete)
**Network:** Sepolia Testnet
**Status:** Testnet operational, ready for Iteration 2

### ✅ Iteration 1 Completed (v6.1.0)

**Smart Contracts (Solidity/Foundry):**
- ✅ Multi-collateral support (ETH, USDC, DAI) with asset-specific LTV ratios
- ✅ ETH-native borrowing with health factor validation
- ✅ Dual-source oracle (Chainlink primary, Uniswap TWAP fallback <5% deviation)
- ✅ 271+ tests (unit + integration), >90% coverage

**Subgraph (TheGraph v6.1.0):**
- ✅ Multi-collateral event indexing (deposits, borrows, repays, liquidations)
- ✅ Position lifecycle tracking (INACTIVE → ACTIVE → REPAID/LIQUIDATED)
- ✅ Global metrics (TVL, utilization, active positions)
- ✅ Daily historical metrics for analytics

**Frontend (Next.js 15 + React 19):**
- ✅ Dashboard (TVL overview, user position, health factor, quick actions)
- ✅ Deposit flow (ETH/USDC/DAI, approval flow, position preview)
- ✅ Borrow flow (amount input, HF simulation, interest rate display)
- ✅ Repay & Withdraw flows (HF safety checks, max buttons, asset selector)
- ✅ Analytics page (TVL charts, utilization gauge, recent activity, oracle prices)
- ✅ Positions page (historical positions, transaction history, filters)
- ✅ RainbowKit wallet integration (Sepolia support)

**Python Bot:**
- ✅ Health factor monitoring (30s intervals)
- ✅ Automated liquidations with gas profitability checks
- ✅ Multi-asset support (ETH, USDC, DAI)
- ✅ Flask API for status monitoring

**Bug Fixes (v6.1.0):**
- ✅ ANO_009 RESOLVED: Cross-user data contamination (subgraph helpers + cache disabled)
- ✅ Oracle price integration: USDC/DAI fetched from OracleAggregator (not hardcoded $1.00)
- ✅ PositionsTable: Borrowed amount display fixed (Wei → ETH)
- ✅ Documentation: JSON format created (KNOWN_ISSUES_ANO.json)

### 🎯 Iteration 2 Roadmap

**Oracle Improvements (Primary Focus):**

**EVO_001 - Real Price Injection System (2-3 weeks):**
- 📊 Fetch mainnet prices (Chainlink + Uniswap V3) via Python collector
- 💾 Store historical data in SQLite (24h-7d granularity)
- ⚙️ Inject into Sepolia mocks via Foundry automation (`cast send`)
- ⏰ Cron job updates every 5-10 minutes
- ✅ Enable realistic volatility testing, deviation scenarios, emergency mode triggers

**EVO_003 - UniswapV3 Oracle Deployment (1-2 weeks):**
- 🔧 Deploy real UniswapV3PriceProvider contracts (code ready, 225+ tests passing)
- 🏊 Configure 30-minute TWAP windows on liquid pools
- 🔀 Register as fallback providers in PriceRegistry
- 🚨 Test deviation-based fallback (>5% triggers TWAP instead of Chainlink)

**Estimated Duration:** 3-5 weeks total

**Why EVO_001/003 (not EVO_002):**
- Production readiness: Real oracle data required for demos & mainnet
- Quick wins: Oracle improvements = 3-5 weeks vs Multi-positions = 4-5 weeks
- Testnet realism: Mock prices ($0.60 USDC) currently unrealistic

**Phase 6C/6D - Contract Fixes (Deferred):**
- Testnet acceptable with ANO_008 workaround (`scripts/transfer_liquidated_collateral.sh`)
- Contract fixes planned for pre-production only (if mainnet launch)

---

## Architecture

**On-chain (Sepolia Testnet):**
- LendingPool v3.0 - Borrow/Repay/Liquidate operations
- CollateralManager v1.1 - Multi-asset deposits (ETH + ERC20)
- OracleAggregator v3.1 - Price aggregation with deviation checks
- PriceRegistry v1.1 - Asset routing to price providers

**Off-chain Services:**
- TheGraph Subgraph - Event indexing (positions, metrics, transactions)
- Python Bot - Automated liquidation monitoring
- Next.js Frontend - User interface with wagmi/RainbowKit

**Price Providers:**
- Chainlink ETH/USD (primary)
- MockUniswapV3 (fallback - Sepolia)
- MockUSDC/DAI providers ($0.60/$1.00 - Sepolia testing)

---

## Deployed Contracts (Sepolia)

| Contract | Address | Version |
|----------|---------|---------|
| **LendingPool** | `0x06AF08708B45968492078A1900124DaA832082cD` | v3.0 |
| **CollateralManager** | `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758` | v1.1 |
| **OracleAggregator** | `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe` | v3.1 |
| **PriceRegistry** | `0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED` | v1.1 |

**Collateral Assets:**
- USDC: `0xC47095AD18C67FBa7E46D56BDBB014901f3e327b`
- DAI: `0x2FA332E8337642891885453Fd40a7a7Bb010B71a`

**Subgraph:** https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest

---

## Quick Start

### Prerequisites
```bash
# Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Node.js 18+
node -v

# Python 3.11+
python --version
```

### Smart Contracts
```bash
forge install
forge build
forge test                          # 271+ tests
```

### Subgraph
```bash
cd subgraph
npm install
npm run codegen && npm run build
```

### Frontend
```bash
cd frontend
npm install
npm run dev                         # http://localhost:3000
```

### Bot
```bash
cd bot
python -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python src/main.py
```

---

## Key Features

### Multi-Collateral Support
Deposit ETH, USDC, or DAI as collateral with asset-specific LTV ratios:
- **ETH:** 66% LTV, 83% liquidation threshold
- **USDC:** 90% LTV, 95% liquidation threshold
- **DAI:** 90% LTV, 95% liquidation threshold

### Health Factor System
Real-time health factor monitoring prevents undercollateralization:
- **HF > 1.5:** Safe (green)
- **HF 1.2-1.5:** Warning (yellow)
- **HF 1.0-1.2:** At-risk (orange)
- **HF < 1.0:** Liquidatable (red)

Formula: `HF = (Collateral Value × Liquidation Threshold) / Borrowed Value`

### Dual-Source Oracle
Automatic failover when price deviation exceeds threshold:
- **< 5%:** Use Chainlink (normal)
- **5-10%:** Use Uniswap TWAP + warning
- **> 10%:** Use Uniswap TWAP + emergency mode

### Automated Liquidations
Python bot monitors positions every 30s:
- Detects HF < 1.0 positions
- Calculates liquidation profitability (including gas)
- Executes profitable liquidations automatically
- Displays warnings for unprofitable liquidations

---

## Repository Structure

```
LendForge/
├── contracts/              # Solidity smart contracts
│   ├── oracles/           # Oracle system v3.1
│   ├── CollateralManager.sol
│   ├── LendingPool.sol
│   └── libraries/         # Shared utilities
├── test/                  # 271+ unit + integration tests
├── script/                # Deployment scripts
├── subgraph/              # TheGraph indexing
│   ├── schema.graphql     # Entity definitions
│   └── src/               # Event handlers
├── frontend/              # Next.js 15 dashboard
│   ├── app/               # Pages (App Router)
│   ├── components/        # UI components
│   ├── hooks/             # Custom hooks
│   └── lib/               # Utilities (GraphQL, wagmi)
├── bot/                   # Python liquidation bot
│   └── src/               # Bot logic
└── _docs/                 # Documentation
    ├── KNOWN_ISSUES_ANO.json  # Machine-readable bugs
    └── issues/            # Detailed issue specs
```

---

## Tech Stack

**Smart Contracts:**
- Solidity 0.8.24 + Foundry
- OpenZeppelin 4.9.6
- Chainlink, Uniswap V3

**Subgraph:**
- TheGraph (AssemblyScript)
- GraphQL queries

**Frontend:**
- Next.js 15 (App Router)
- React 19 + TypeScript
- wagmi v2 + RainbowKit v2
- Apollo Client (GraphQL)
- Recharts (analytics)
- Tailwind CSS + shadcn/ui

**Bot:**
- Python 3.11+
- web3.py
- APScheduler
- Flask API

---

## Known Issues

See [_docs/KNOWN_ISSUES_ANO.json](_docs/KNOWN_ISSUES_ANO.json) for machine-readable issue list.

**Active Bugs (require contract fixes):**
- **ANO_006:** Missing pool liquidity validation → borrow() reverts with generic error
- **ANO_008:** Liquidation missing collateral transfer → blocks production

**Mitigated (workarounds in place):**
- **ANO_001:** GlobalMetric.activePositions always 0 → client-side counting
- **ANO_002:** Asset decimals hardcoded 18 → ASSET_DECIMALS mapping override
- **ANO_003:** UserCollateral.valueUSD stores total → calculate per-asset
- **ANO_004:** currentTVL adds mixed decimals → manual calculation with correct parsing
- **ANO_005:** DailyMetric missing ETH price → pass current price for history

**Resolved:**
- **ANO_009:** Cross-user data contamination (v6.1.0 fix)

---

## Testing

### Smart Contracts
```bash
forge test                           # All tests
forge test --match-contract LendingPoolTest
forge test --match-test testBorrowSuccess -vvv
forge coverage                       # >90% coverage
```

### Frontend
Manual testing workflow:
1. Connect wallet (DEPLOYER or USER)
2. Deposit collateral → verify TVL updates
3. Borrow ETH → verify HF calculation
4. Check /positions → should show only connected user's data
5. Switch wallet → verify no data mixing

### Bot
```bash
cd bot
python -m pytest tests/ -v
```

---

## Documentation

**Machine-readable:**
- [CLAUDE.md](CLAUDE.md) - Claude Code guide
- [_docs/KNOWN_ISSUES_ANO.json](_docs/KNOWN_ISSUES_ANO.json) - Bugs/anomalies index
- [_docs/issues/ANO_*.json](_docs/issues/) - Detailed issue specs

**Human-readable:**
- [ROADMAP.md](ROADMAP.md) - Development roadmap
- [_docs/KNOWN_ISSUES.md](_docs/KNOWN_ISSUES.md) - Issue summaries
- [_docs/issues/ANO_*.md](_docs/issues/) - Detailed issue docs

---

## Security

⚠️ **Testnet Only - Not Production Ready**

**Current Status:**
- Sepolia testnet deployment
- Mock oracles for USDC/DAI (unreliable Sepolia feeds)
- Known contract bugs (ANO_006, ANO_008) require fixes before mainnet

**Pre-Production Requirements:**
- Security audit (Certora/OpenZeppelin)
- Fix ANO_006 (liquidity validation)
- Fix ANO_008 (liquidation collateral transfer)
- Deploy real Chainlink feeds + liquid Uniswap pools
- Mainnet stress testing

---

## License

MIT

---

## Contributing

Contributions welcome! Please:
1. Check [_docs/KNOWN_ISSUES_ANO.json](_docs/KNOWN_ISSUES_ANO.json) for existing bugs
2. Read [CLAUDE.md](CLAUDE.md) for architecture patterns
3. Follow existing code style (Prettier for frontend, Forge fmt for contracts)
4. Write tests for new features

---

## Contact

- GitHub Issues: Bug reports and feature requests
- Documentation: See `_docs/` for technical specs

