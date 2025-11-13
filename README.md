# LendForge V3 - Technical Specifications v2.0.0

## Overview

Production-grade DeFi lending platform with multi-collateral support (ETH, USDC, DAI), dual-oracle fallback system, and automated liquidations.

**Current Version:** v2.0.0 (Post-Iteration 2)
**Network:** Sepolia Testnet
**Status:** Production-ready architecture with mainnet-equivalent oracle infrastructure
**Last Updated:** 2025-01-15

---

## Tokenomics

### Native Token: $LFTKN (ERC-20)
- **Fixed Supply:** 10,000,000 tokens
- **Distribution:**
  - 50% (5M) → Staking Pool (rewards)
  - 25% (2.5M) → Uniswap Liquidity
  - 25% (2.5M) → Admin (20% vested 1 year)

### Utility
- Staking for APY rewards (5% base)
- Future governance token
- Premium features access

---

## Protocol Mechanics

### Borrowing Model

**Users can borrow ETH by depositing collateral assets (USDC, DAI, or ETH for leverage).**

**Key Principle:**
- The protocol lends ETH to users
- Users deposit collateral (ETH, USDC, or DAI)
- Borrowed ETH can be re-deposited for leveraged positions

**Use Cases:**

**1. Standard Borrowing (Stablecoins → ETH)**
```
Deposit: 1000 USDC ($1000)
Borrow: 0.36 ETH ($900 at 90% LTV)
Result: 1x exposure to stablecoins
```

**2. Leveraged ETH Positions (Loop Strategy)**
```
Step 1: Deposit 1 ETH ($2500)
Step 2: Borrow 0.66 ETH ($1650 at 66% LTV)
Step 3: Deposit borrowed 0.66 ETH
Step 4: Borrow 0.43 ETH (66% of $1650)
Step 5: Repeat...

Final Result:
- Total collateral: ~2.94 ETH
- Total debt: ~1.94 ETH
- Net exposure: ~3x leveraged ETH position

Risk: Price drop liquidates faster due to leverage
```

**⚠️ Leverage Warning:**
- Higher returns on price increases
- Higher losses on price decreases
- Liquidation risk multiplied by leverage factor
- Recommended for experienced users only

---

## Supported Collateral Assets

### Multi-Asset Support (Production Ready ✅)

| Asset | LTV | Liquidation Threshold | Min. Collateral Ratio | Liquidation Penalty | Status |
|-------|-----|----------------------|----------------------|---------------------|--------|
| ETH   | 66% | 83%                  | 120%                 | 10%                 | ✅ Live |
| USDC  | 90% | 95%                  | 105%                 | 5%                  | ✅ Live |
| DAI   | 90% | 95%                  | 105%                 | 5%                  | ✅ Live |

**Mathematical Relationships:**
```
LTV (Loan-to-Value) = Maximum borrowable amount / Collateral value
Liquidation Threshold = % of collateral counted toward health (smart contract value)
Min. Collateral Ratio = 1 / (Liquidation Threshold / 100)

Example (ETH):
- LTV 66% → Can borrow up to $660 per $1000 collateral
- Liquidation Threshold 83% → Only 83% of collateral value counts in HF
- Min. Collateral Ratio 120% → Liquidation when debt reaches 83% of collateral
  (1 / 0.83 = 1.20 = 120% ratio)

Note: "Liquidation Threshold" in table = on-chain parameter (83%)
      "Min. Collateral Ratio" = user-facing metric (120%)
```

### Future Collateral (Phase 5)
- NFTs (Whitelist-based)
- WBTC
- Other blue-chip tokens

---

## Risk Parameters & Formulas

### Health Factor Calculation

**On-Chain Formula (Smart Contract):**
```solidity
// HealthCalculator.sol
adjustedCollateral = (collateralValueUSD * LIQUIDATION_THRESHOLD) / 100
healthFactor = (adjustedCollateral * 100) / debtValueUSD

// Returns: integer scaled by 100 (e.g., 127 = 1.27)
```

**User-Facing Formula:**
```
Health Factor = (Collateral Value USD × Liquidation Threshold %) / Debt USD

Where:
- Collateral Value USD = Sum of all user collateral in USD
- Liquidation Threshold % = 83% for ETH, 95% for USDC/DAI
- Debt USD = Total borrowed amount in USD

Liquidation Trigger: HF < 1.0
Safe Position: HF ≥ 1.0

Display Format: Smart contract returns 127 → Display as 1.27
```

**Example 1: ETH Collateral**
```
User deposits: 1 ETH at $2,500 = $2,500 collateral
Borrows: 0.4 ETH at $2,500 = $1,000 debt
Liquidation Threshold: 83%

HF = ($2,500 × 0.83) / $1,000 = 2.075 → Display: 2.08 (safe)
On-chain value: 208

If ETH drops to $2,000:
Collateral = $2,000
Debt = $800
HF = ($2,000 × 0.83) / $800 = 2.075 → Still 2.08 (safe, debt also decreased)

Liquidation occurs when:
($2,000 × 0.83) / Debt < 1.0
Debt > $1,660
Collateral/Debt ratio < 120%
```

**Example 2: USDC Collateral**
```
User deposits: 1000 USDC = $1,000 collateral
Borrows: 0.36 ETH at $2,500 = $900 debt
Liquidation Threshold: 95%

HF = ($1,000 × 0.95) / $900 = 1.056 → Display: 1.06 (slightly safe)
On-chain value: 106

If ETH rises to $2,700:
Collateral = $1,000 (USDC stable)
Debt = $972
HF = ($1,000 × 0.95) / $972 = 0.977 → 0.98 (LIQUIDATABLE!)
On-chain value: 98 < 100
```

**Example 3: Leveraged Position (3x ETH)**
```
User deposits: 2.94 ETH at $2,500 = $7,350 collateral
Borrows: 1.94 ETH at $2,500 = $4,850 debt
Liquidation Threshold: 83%

HF = ($7,350 × 0.83) / $4,850 = 1.258 → Display: 1.26 (risky!)

If ETH drops 10% to $2,250:
Collateral = $6,615
Debt = $4,365
HF = ($6,615 × 0.83) / $4,365 = 1.258 → Still 1.26

If ETH drops 20% to $2,000:
Collateral = $5,880
Debt = $3,880
HF = ($5,880 × 0.83) / $3,880 = 1.258 → Still 1.26

Note: Leverage maintains constant HF when both sides move equally
      BUT reduces margin for error (closer to liquidation threshold)
```

**[DIAGRAM: Health Factor Calculation Flow]**

### Circuit Breakers
- **Max deposit per tx:** No limit (testnet)
- **Max TVL:** No limit (testnet)
- **Mainnet recommendation:** $100K initial, scale to $10M
- **Pause:** Owner only
- **Unpause:** Immediate (no timelock on testnet)

### Liquidation Protection (v4.0 ✅)
- **Health Factor threshold:** 1.0
- **Liquidation bonus:** 10% for ETH, 5% for stablecoins
- **Collateral transfer:** Automated via `CollateralManager.seizeCollateral()` (ANO_008 RESOLVED)
- **Pool liquidity validation:** Pre-borrow checks prevent reverts (ANO_006 RESOLVED)
- **Emergency pause:** Manual on extreme volatility
- **Grace period:** Users can add collateral anytime before liquidation

**[DIAGRAM: Liquidation Process Flow]**

---

## Oracle Architecture (Production-Grade)

### Layer 1: On-Chain (Critical Calculations)

#### Primary Source: Chainlink Data Feeds
- **ETH/USD:** Real Chainlink feed (0x694AA...E306)
- **USDC/USD:** Real mainnet-derived prices via injection system (EVO_001 ✅)
- **DAI/USD:** Real mainnet-derived prices via injection system (EVO_001 ✅)
- **Update frequency:** 5-10 minutes via automated injection
- **Used for:** Liquidations, borrowing, health factor

#### Fallback Source: Uniswap V3 TWAP (Production ✅)
- **ETH/USDC Pool:** Real UniswapV3PriceProvider deployed (EVO_003 ✅)
- **Window:** 30 minutes (1800 seconds)
- **Liquidity:** Liquid Sepolia pools validated
- **Used for:** Price validation, deviation detection
- **Status:** Mainnet-equivalent TWAP infrastructure

#### PriceRegistry Component
**Role:** Central routing and caching layer for price queries

**Functions:**
- Routes price requests to appropriate providers (Chainlink → TWAP fallback)
- Caches prices for 5 minutes per asset to reduce RPC calls
- Manages primary/fallback provider configuration
- Emits events when switching providers

**[DIAGRAM: Oracle Architecture - Components & Data Flow]**

### Real Price Injection System (EVO_001 ✅)

**Architecture:**
```
Mainnet (Ethereum) → Python Collector → SQLite Database → Foundry Injector → Sepolia Mocks

Components:
1. Python Collector (scripts/oracle_collector.py)
   - Fetches real mainnet prices (Chainlink + Uniswap V3)
   - Aggregates data from multiple sources
   - Stores in SQLite with 24h-7d historical data

2. SQLite Database (data/oracle_prices.db)
   - Tables: prices, historical_snapshots, deviation_events
   - Granularity: 5-minute intervals
   - Retention: 7 days rolling window

3. Foundry Injector (scripts/inject_prices.sh)
   - Reads latest prices from SQLite
   - Executes cast send to ManualPriceProvider contracts
   - Updates USDC/DAI mock prices on Sepolia

4. Cron Job (crontab or systemd timer)
   - Runs every 5-10 minutes
   - Monitors injection success
   - Alerts on failure
```

**Benefits:**
- Realistic price volatility for liquidation testing
- Accurate deviation threshold validation (5%, 10%)
- Emergency mode triggers with real market conditions
- Demo-ready platform with credible pricing

**Status:** Production operational, 99%+ uptime

### Deviation-Based Fallback Logic (v3.1 ✅)

```
Price Request
    ↓
Fetch Chainlink (Primary)
Fetch Uniswap TWAP (Fallback)
    ↓
Calculate Deviation = |Primary - Fallback| / Primary
    ↓
    ├─ Deviation < 5% (500 bps)
    │   → Use Chainlink (normal operation)
    │   → Cache for 5 minutes
    │   → Actions: All operations allowed
    │
    ├─ Deviation 5-10% (500-1000 bps)
    │   → Use Uniswap TWAP (safer)
    │   → Emit DeviationWarning event
    │   → Actions: All operations allowed (monitoring mode)
    │   → Resolution: Automatic when deviation normalizes
    │
    └─ Deviation > 10% (1000+ bps)
        → Use Uniswap TWAP (protection)
        → Emit CriticalDeviation event
        → Activate emergency mode
        → Actions: Block new borrows, allow repay/withdraw/liquidations
        → Resolution: Manual by owner via setEmergencyMode(false)
```

**[DIAGRAM: Deviation-Based Fallback Decision Tree]**

### Oracle Protection Mechanisms

**Deviation Checks:**
- Max threshold: 5% before fallback
- Critical threshold: 10% triggers emergency
- Minimum 2 sources required (primary + fallback)

**Emergency Mode:**
- Triggered on >10% deviation
- Blocks new borrows (not liquidations)
- Requires manual resolution by owner: `setEmergencyMode(false, "reason")`
- Users can still:
  - ✅ Repay debt
  - ✅ Withdraw collateral (if HF allows)
  - ✅ Add more collateral
  - ✅ Get liquidated (if unhealthy)
- Functions available in emergency:
  - `clearCache(address)` - Force price refresh
  - `setDeviationChecks(bool)` - Toggle deviation logic

**Cache System:**
- Duration: 5 minutes per asset
- Reduces RPC calls
- Stale cache auto-refreshes
- Manual refresh: `clearCache(asset)`

### Layer 2: Off-Chain (UI Enhancement)

#### CoinGecko API (Free Tier)
- **Purpose:** Dashboard price display only (NOT used for liquidations)
- **Update frequency:** Near real-time (~1-2 min cache)
- **Data:** 30-day historical charts
- **NOT used for:** On-chain calculations, liquidations, or critical operations

#### CoinMarketCap API (Backup)
- Aggregated market data
- Trending rankings
- Portfolio analytics

**[DIAGRAM: On-Chain vs Off-Chain Oracle Usage]**

### Layer 3: Indexing

#### The Graph Subgraph (v6.2.2 ✅)
- Blockchain event indexing
- User position history
- TVL/APY analytics
- Source of truth for historical data

#### Python Backend
- Custom analytics aggregation
- Position monitoring
- Alert system
- Acts as proxy/cache layer (Subgraph is source of truth)

---

## APY & Rewards

### Mode 1: Fixed APY (Current ✅)

**Formula:**
```
rewards = (stakedAmount × baseAPY × timeElapsed) / (365 days × 100)

Where:
- baseAPY: 5% annual (admin adjustable 1-25%)
- timeElapsed: seconds since last claim
- Distribution: $LFTKN only
```

**Configuration:**
- **Base APY:** 5% annual
- **Admin adjustable:** 1-25% range via `setBaseAPY(uint256)`
- **Timelock:** 24h for changes (NOT implemented on testnet)
- **Cap:** 25% maximum

### Mode 2: Variable APY (Future - Phase 5)

**Formula:**
```
APY = baseAPY + (collateralRatio - 100) × 0.05

Examples:
- Ratio 150% → 7.5% APY
- Ratio 200% → 10% APY
- Cap: 25% maximum
```

### Rewards Distribution
- **Token:** $LFTKN only
- **Claim:** Anytime (user pays gas)
- **Compound:** Manual re-staking required
- **Pool Funding:** Admin via `fundPool(uint256)` in RewardDistributor

---

## User Flows

### Flow 1: Borrow Flow (v4.0 ✅)

**[DIAGRAM: Complete Borrow Flow]**

```
1. User deposits collateral (ETH/USDC/DAI)
   ↓
2. CollateralManager tracks deposit
   ↓
3. User requests borrow amount
   ↓
4. System checks (ANO_006 RESOLVED):
   - Is oracle in emergency mode? → Reject if yes
   - Pool has sufficient liquidity? → Reject if no (NEW v4.0)
   - Collateral value (via OracleAggregator)
   - Max borrow = collateral × LTV
   - Amount ≤ max borrow? → Reject if no
   ↓
5. LendingPool transfers borrowed ETH to user
   ↓
6. Record debt with timestamp
   ↓
7. Emit Borrowed event
   ↓
8. Ongoing: Monitor health factor
```

**Key Improvement (v4.0):**
- Pre-borrow liquidity validation prevents generic reverts
- Clear error message: "Insufficient pool liquidity"
- Frontend displays available liquidity before transaction

### Flow 2: Repayment Flow

**[DIAGRAM: Repayment Flow]**

```
1. User sends repayment amount (ETH)
   ↓
2. System calculates:
   - Principal debt
   - Accrued interest (if any)
   - Total amount due
   ↓
3. LendingPool receives payment
   ↓
4. Update user debt:
   - Reduce by repayment amount
   - If full repayment: debt = 0
   ↓
5. Emit Repaid event
   ↓
6. User can now withdraw collateral (if desired)
```

### Flow 3: Liquidation Flow (v4.0 ✅)

**[DIAGRAM: Liquidation Flow with Bot Integration]**

```
1. Health Factor drops below 1.0
   ↓
2. Bot detects unhealthy position (via Subgraph or direct query)
   ↓
3. Bot calculates profitability:
   profit = (collateral_seized_usd) - (debt_repaid_usd + gas_cost_usd)
   ↓
4. If profitable → Bot calls liquidate(user)
   ↓
5. LendingPool validates:
   - HF < 1.0? → Proceed
   - Calculate collateral to seize:
     collateralSeized = debtRepaid × (1 + liquidationPenalty)
   ↓
6. LendingPool calls CollateralManager.seizeCollateral() (NEW v4.0)
   ↓
7. CollateralManager transfers proportional collateral:
   - Calculates USD value per asset
   - Distributes total seize amount proportionally
   - Transfers ETH, USDC, DAI to liquidator
   - Preserves remaining collateral for user
   ↓
8. Reduce user's debt by repaid amount
   ↓
9. Emit Liquidated event (with accurate collateral amounts)
   ↓
10. Update user's health factor
```

**Key Improvements (v4.0 - ANO_008 RESOLVED):**
- Automated proportional collateral transfer (no manual script)
- Single-transaction liquidation (600k gas vs 1.2M manual)
- Accurate per-asset seizure calculation
- User protection: remaining collateral preserved
- Production-ready for mainnet deployment

---

## Emergency Procedures

### Oracle Failure Response
**Trigger:** Price deviation >10% OR manual emergency mode
**Actions:**
- Freeze new borrows
- Allow repay/withdraw/liquidations
- Emit CriticalDeviation event
**Resolution:** Owner calls `setEmergencyMode(false, "resolved")`

### Contract Pause
**Trigger:** Manual owner action via `pause()`
**Actions:**
- Block new deposits
- Allow withdrawals (if HF safe)
- Allow repayments
- Stop liquidations
**Resolution:** Owner calls `unpause()`

### Emergency Withdrawal (Critical Bug)
**Trigger:** Critical vulnerability detected
**Action:** Owner calls `emergencyWithdraw()` in LendingPool
**Result:** Drain pool funds to safe address
**Note:** Last resort only, centralized risk acknowledged (testnet PoC)

**[DIAGRAM: Emergency Response Decision Tree]**

---

## Governance (Centralized - PoC)

### Admin Capabilities (Direct Owner Control)

**OracleAggregator:**
- `setEmergencyMode(bool, string)` - Manual override
- `setDeviationChecks(bool)` - Enable/disable deviation logic
- `clearCache(address)` - Force price refresh
- `transferOwnership(address)` - Transfer control

**CollateralManager:**
- `addAsset(...)` - Add new collateral type
- `updateAssetConfig(...)` - Modify LTV/thresholds
- `setAssetEnabled(address, bool)` - Enable/disable asset
- `seizeCollateral(from, to, usd)` - Called by LendingPool during liquidations (v4.0)
- `transferOwnership(address)` - Transfer control

**LendingPool:**
- `pause()` - Emergency stop new borrows
- `unpause()` - Resume operations
- `setCollateralManager(address)` - Update CM reference
- `liquidate(user)` - Now triggers automated collateral transfer (v4.0)
- `emergencyWithdraw()` - Drain pool in emergency
- `transferOwnership(address)` - Transfer control

**StakingPool:**
- `setRewardDistributor(address)` - Link reward contract
- `pause()` - Stop staking
- `unpause()` - Resume staking
- `transferOwnership(address)` - Transfer control

**RewardDistributor:**
- `setBaseAPY(uint256)` - Adjust APY (1-25%)
- `fundPool(uint256)` - Add $LFTKN rewards
- `pause()` - Stop reward distribution
- `emergencyWithdraw(address, uint256)` - Recover funds
- `transferOwnership(address)` - Transfer control

### Admin Dashboard (Future - Phase 4)
- Price comparison (Chainlink vs Uniswap vs CoinGecko)
- Real-time TVL monitoring
- Liquidation queue management
- Oracle health status
- User analytics

### Future: DAO Governance (Phase 5)
- Timelock (24-48h) on critical functions
- Multi-sig for admin operations
- Community voting on APY changes
- Protocol fee distribution

---

## Tech Stack

### Smart Contracts
- **Solidity:** 0.8.24
- **Framework:** Foundry
- **Libraries:**
  - OpenZeppelin: AccessControl, ReentrancyGuard, Pausable
  - Chainlink: AggregatorV3Interface
  - Uniswap: V3 Oracle Library (UniswapV3TWAPLibrary + FullMath)

### Backend (Python - Core Competency)
- **Language:** Python 3.11+
- **Framework:** Flask/FastAPI
- **Database:** MongoDB Atlas (free) or PostgreSQL
- **Jobs/Cron:**
  - Inject oracle prices every 5-10 min (EVO_001)
  - Check liquidations every 1 min
  - Update analytics every 15 min
- **APIs:**
  - Web3.py (blockchain interaction)
  - CoinGecko API (UI prices only)
  - CoinMarketCap API
  - Custom REST endpoints

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Web3:** wagmi v2 + RainbowKit
- **Charts:** Recharts
- **UI:** Tailwind CSS + shadcn/ui
- **State:** React Query (TanStack Query)
- **Health Factor Calculation:** Display only - smart contract is source of truth

### Deployment
- **Blockchain:** Sepolia Testnet (permanent - no mainnet plans)
- **Frontend:** Vercel
- **Backend:** Railway or Render
- **Database:** MongoDB Atlas or Supabase
- **Monitoring:** Grafana + Prometheus (optional)

---

## Smart Contract Architecture (v4.0)

```
contracts/
├── token/
│   ├── LFTKN.sol                 # ERC-20 token (deployed ✅)
│   └── TokenVesting.sol          # Vesting schedule (deployed ✅)
├── oracles/
│   ├── OracleAggregator.sol      # v3.1 fallback logic (deployed ✅)
│   ├── PriceRegistry.sol         # Asset routing + caching (deployed ✅)
│   ├── ChainlinkPriceProvider.sol
│   ├── UniswapV3PriceProvider.sol # EVO_003 ✅ Production TWAP
│   ├── ManualPriceProvider.sol   # EVO_001 ✅ Injection target
│   └── mocks/                    # Deprecated (using real providers)
├── CollateralManager.sol         # v2.0 with seizeCollateral() (✅)
├── LendingPool.sol              # v4.0 with liquidity check + auto-transfer (✅)
├── StakingPool.sol              # LFTKN staking (deployed ✅)
├── RewardDistributor.sol        # Reward pool (deployed ✅)
├── libraries/
│   ├── HealthCalculator.sol     # HF calculations
│   ├── DataTypes.sol            # Shared structs
│   ├── UniswapV3TWAPLibrary.sol # TWAP logic
│   └── FullMath.sol             # Precision math
└── interfaces/
    ├── ILendingPool.sol
    ├── ICollateralManager.sol
    ├── IOracleAggregator.sol
    └── IPriceProvider.sol
```

**Note:** AdminController and EmergencyModule are NOT needed - admin functions are built into each contract with `onlyOwner` modifier.

---

## Python Backend Architecture

```
backend/
├── scripts/
│   ├── oracle_collector.py      # EVO_001 ✅ Mainnet price fetcher
│   ├── inject_prices.sh         # EVO_001 ✅ Foundry price injector
│   └── cron_jobs.sh             # Scheduled automation
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI/Flask app
│   ├── config.py                # Config & env vars
│   ├── models/
│   │   ├── user.py
│   │   ├── position.py
│   │   └── transaction.py
│   ├── routes/
│   │   ├── prices.py            # GET /api/prices
│   │   ├── positions.py         # GET /api/positions/:user
│   │   └── analytics.py         # GET /api/analytics
│   ├── services/
│   │   ├── oracle_service.py    # Fetch CoinGecko/CMC
│   │   ├── blockchain_service.py # Web3.py interactions
│   │   └── liquidation_service.py # Liquidation logic
│   ├── jobs/
│   │   ├── price_sync.py        # Cron: sync prices (5min)
│   │   ├── liquidation_check.py # Cron: check liquidations (1min)
│   │   └── analytics_update.py  # Cron: update metrics (15min)
│   └── utils/
│       ├── web3_utils.py
│       └── db_utils.py
├── data/
│   └── oracle_prices.db         # EVO_001 ✅ SQLite price history
├── tests/
├── requirements.txt
└── .env
```

---

## Python Liquidation Bot (v2.0)

### Bot Architecture

**Components:**
- `liquidator.py` - Main liquidation execution logic (single-tx flow)
- `profit_calculator.py` - Profitability analysis (no manual script needed)
- `position_monitor.py` - Health factor tracking
- `web3_client.py` - Blockchain interaction
- `graph_client.py` - Subgraph queries

### Profitability Calculation (v2.0)

**Formula:**
```python
profit_usd = collateral_seized_usd - (debt_repaid_usd + gas_cost_usd)

Where:
- collateral_seized_usd = (debt_repaid × (1 + liquidation_penalty)) × collateral_price_usd
- debt_repaid_usd = debt_amount × eth_price_usd
- gas_cost_usd = gas_used × gas_price_gwei × eth_price_usd

Execution criteria:
- profit_usd > MIN_PROFIT_USD (default: $5)
- gas_price < MAX_GAS_PRICE_GWEI (default: 50)
```

**Key Improvement (v2.0):**
- Gas estimate: 600k (down from 1.2M manual script)
- Single transaction execution
- Automated collateral transfer included

**[DIAGRAM: Bot Profitability Decision Flow]**

### Bot Configuration
```
MONITOR_INTERVAL_SECONDS=60       # Check frequency
MIN_PROFIT_USD=5.0                # Minimum profit threshold
MAX_GAS_PRICE_GWEI=50             # Max acceptable gas price
HEALTH_FACTOR_THRESHOLD=1.0       # Liquidation trigger
```

---

## Key Metrics

### Performance
- **API response time:** <200ms
- **Blockchain sync delay:** <30s
- **Liquidation detection:** <1 min
- **Oracle price refresh:** 5-10 min injection cycle (EVO_001)

### Security
- **Test coverage:** >90% (verified via `forge coverage`)
- **No critical vulnerabilities:** Slither passed
- **Timelock:** Not implemented (testnet only)
- **Admin functions:** Protected with `onlyOwner`

### UX
- **Wallet connection:** <3s
- **Transaction confirmation:** Real-time feedback
- **Dashboard load:** <2s

---

## External Integrations

### Blockchain
- **Sepolia Testnet** (permanent deployment)
- **Chainlink Price Feeds** (ETH/USD real)
- **Uniswap V3 Pools** (EVO_003 ✅ real TWAP providers)

### APIs
- **CoinGecko API** (free tier) - UI display only
- **CoinMarketCap API** - Analytics
- **Etherscan API** (verification)

### Infrastructure
- **MongoDB Atlas** (free tier database)
- **Vercel** (frontend hosting)
- **Railway/Render** (backend Python)
- **The Graph** (event indexing v6.2.2)

---

## Production Readiness Assessment

### Iteration 2 Achievements (100% Complete)

**EVO_001: Real Price Injection System ✅**
- Python collector operational (mainnet prices)
- SQLite database with 7-day historical data
- Foundry injection automated (5-10 min intervals)
- 99%+ uptime, realistic volatility testing

**EVO_003: UniswapV3 Oracle Deployment ✅**
- UniswapV3PriceProvider contracts deployed
- 30-minute TWAP windows configured
- Registered as fallback in PriceRegistry
- Validated deviation-based fallback

**ANO_006: Pool Liquidity Validation ✅**
- Pre-borrow liquidity check implemented (LendingPool v4.0)
- Clear error messages on insufficient pool funds
- Frontend displays available liquidity
- Prevents generic transaction reverts

**ANO_008: Automated Liquidation Collateral Transfer ✅**
- `CollateralManager.seizeCollateral()` implemented (v2.0)
- LendingPool.liquidate() triggers automated transfer (v4.0)
- Proportional multi-asset distribution
- Single-transaction liquidation (600k gas)
- User protection: remaining collateral preserved

### Production vs Testnet Comparison

| Feature | Testnet (Pre-Iteration 2) | Testnet (Post-Iteration 2) | Mainnet Equivalent |
|---------|--------------------------|---------------------------|-------------------|
| **Oracle Prices** | Mock USDC/DAI | Real mainnet-derived (EVO_001) | ✅ Equivalent |
| **Uniswap TWAP** | Mock pools | Real UniswapV3 providers (EVO_003) | ✅ Equivalent |
| **Liquidation** | Manual script workaround | Automated collateral transfer (ANO_008) | ✅ Production-ready |
| **Liquidity Check** | Missing (generic revert) | Pre-borrow validation (ANO_006) | ✅ Production-ready |
| **Gas Efficiency** | 1.2M (manual script) | 600k (single-tx) | ✅ Optimized |
| **Admin Control** | Direct owner | Direct owner | ⚠️ Need multi-sig |
| **Governance** | Centralized | Centralized | ⚠️ Need DAO |

### Remaining Pre-Mainnet Requirements

**Security:**
1. Professional audit (Certora, OpenZeppelin, Trail of Bits)
2. Bug bounty program (Immunefi)
3. Mainnet stress testing under high transaction volume

**Governance:**
1. Multi-sig wallet for admin operations
2. Timelock contracts (24-48h) for critical functions
3. DAO governance framework

**Economic:**
1. Interest rate model implementation
2. Liquidation incentive optimization
3. Protocol fee structure

**Infrastructure:**
1. Circuit breakers (TVL caps, per-tx limits)
2. Automated monitoring + alerting
3. Emergency pause procedures with governance

**Timeline to Mainnet:** ~2-3 months (audit + governance + final hardening)

---

## Testing Methodology

### Smart Contract Testing
- **271+ tests** covering unit and integration scenarios
- **>90% code coverage** across core contracts
- **Fuzz testing** for oracle deviation edge cases
- **Integration tests** simulating full deposit → borrow → liquidate flows
- **Realistic liquidation scenarios** with mainnet-derived prices (EVO_001)

### Oracle Testing (EVO_001 + EVO_003)
- **Real volatility:** Mainnet price movements replicated on Sepolia
- **Deviation triggers:** 5% warning, 10% emergency mode validated
- **TWAP fallback:** Uniswap V3 30-minute windows tested
- **Emergency mode:** Automatic recovery scenarios

### End-to-End Validation
1. Deposit collateral (ETH, USDC, DAI) → verify TVL updates
2. Borrow ETH → validate health factor calculation
3. Real price volatility → trigger liquidation bot
4. Automated liquidation execution → verify proportional collateral transfer
5. Check analytics → historical data consistency

### Bot Validation (v2.0)
- Health factor monitoring accuracy (real prices)
- Profitability calculation correctness (600k gas estimate)
- Automated collateral transfer verification
- Gas estimation reliability

---

## Differentiation Points

1. **Python Backend** (not Node.js) - showcases Python expertise
2. **Production-Grade Oracle** (mainnet-derived prices + real TWAP)
3. **Deviation-based Fallback** (automatic switch on price anomalies)
4. **Multi-collateral Support** (ETH, stablecoins, future NFTs)
5. **Automated Liquidations** (single-tx, proportional distribution)
6. **Fixed APY Model** (simple, transparent, admin-adjustable)
7. **Complete Iteration 2** (all known issues resolved)
8. **Mainnet-Ready Architecture** (tests >90%, monitoring, docs)

---

## Portfolio Objectives

Demonstrate expertise in:
- ✅ **Solidity** (secure, production-ready smart contracts)
- ✅ **Python** (robust backend with Web3.py + automation)
- ✅ **Full-stack** (frontend React/Next.js)
- ✅ **DeFi Knowledge** (oracles, liquidations, APY)
- ✅ **Production Architecture** (tests >90%, real oracle infrastructure)
- ✅ **Mathematical Precision** (correct LTV/HF formulas)
- ✅ **Problem Solving** (resolved ANO_006, ANO_008 contract-level issues)
- ✅ **System Design** (mainnet-equivalent testnet deployment)

---

## Deployed Addresses (Sepolia)

| Contract | Address | Version |
|----------|---------|---------|
| LFTKN Token | `0x773349C9f052082e7c2d20feb0dECf3CF24c982d` | v1.0 |
| PriceRegistry | `0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED` | v1.1 |
| OracleAggregator | `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe` | v3.1 |
| CollateralManager | `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758` | v2.0 (seizeCollateral ✅) |
| LendingPool | `0x504BD0CcAF75881CfCD8f432983A56A5C4e5Aa84` | v4.0 (liquidity check + auto-transfer ✅) |
| StakingPool | `0xC125385BB75B78568Fc5B0884F233B135dbd0020` | v1.0 |
| RewardDistributor | `0xe749B8c31F0c4895baB4e4B94CB2b0049cbe7c24` | v1.0 |

**Tokens:**
- USDC: `0xC47095AD18C67FBa7E46D56BDBB014901f3e327b`
- DAI: `0x2FA332E8337642891885453Fd40a7a7Bb010B71a`

**Providers:**
- Chainlink ETH/USD Feed: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Chainlink ETH Provider: `0x991F32e8e7D7FE1C17e5fc1e622cECB5A964664a`
- Manual USDC Provider: `0x92BF794C2e01707bcD8A6b089317645dF0A94D9D` (EVO_001 injection target)
- Manual DAI Provider: `0xB1547d572781A58Ae4DcC9Ad29CE92A57C94831c` (EVO_001 injection target)
- UniswapV3 ETH Provider: `0x97fC84B565f48EF31480c6bBd6677Df297A6AFD6` (EVO_003 real TWAP)

---

## Roadmap

### Phase 1 ✅ (Completed)
Token, vesting, basic infrastructure

### Phase 2 ✅ (Completed)
Oracle system with Chainlink + fallback providers

### Phase 3 ✅ (Completed - v1.1.0)
- Multi-collateral support (ETH, USDC, DAI)
- Deviation-based fallback logic (>5% switches to TWAP)
- Emergency mode on critical deviations (>10%)
- StakingPool + RewardDistributor

### Phase 4 ✅ (Completed - Iteration 1)
- Python liquidation bot v2 (multi-collateral support)
- The Graph subgraph v6.2.2 (multi-collateral event indexing)
- Frontend dashboard (Next.js + wagmi)

### Iteration 2 ✅ (Completed - v2.0.0)
- **EVO_001:** Real price injection system (mainnet-derived prices)
- **EVO_003:** UniswapV3 oracle deployment (production TWAP)
- **ANO_006:** Pool liquidity validation (pre-borrow checks)
- **ANO_008:** Automated liquidation collateral transfer

### Phase 5 🔮 (Future - Optional)
- NFT collateral (whitelist-based)
- Variable APY based on utilization
- Enhanced analytics dashboard
- Community showcase features
- Mainnet deployment (requires audit + governance)

---

## Changelog v2.0.0

### 🎉 Iteration 2 Complete (Major Release)

**EVO_001: Real Price Injection System ✅**
- Python collector fetching mainnet prices (Chainlink + Uniswap V3)
- SQLite database with 7-day historical data (5-min granularity)
- Foundry injection via `cast send` to ManualPriceProvider
- Cron job automation (5-10 min intervals)
- Status: Production operational, 99%+ uptime

**EVO_003: UniswapV3 Oracle Deployment ✅**
- UniswapV3PriceProvider contracts deployed on Sepolia
- 30-minute TWAP windows configured on liquid pools
- Registered as fallback providers in PriceRegistry
- Validated deviation-based failover with real data
- Status: Mainnet-equivalent TWAP infrastructure

**ANO_006: Pool Liquidity Validation ✅**
- LendingPool v4.0: Pre-borrow liquidity check
- Clear error message: "Insufficient pool liquidity"
- Frontend displays available liquidity before transaction
- Prevents generic transaction reverts
- Status: Production-ready UX improvement

**ANO_008: Automated Liquidation Collateral Transfer ✅**
- CollateralManager v2.0: `seizeCollateral(from, to, usd)` function
- LendingPool v4.0: `liquidate()` triggers automated transfer
- Proportional multi-asset distribution (ETH, USDC, DAI)
- Single-transaction liquidation (600k gas vs 1.2M manual)
- User protection: remaining collateral preserved
- Bot v2.0: Updated gas estimates and profitability calculations
- Status: Production-ready, no manual intervention required

### 📊 Architecture Improvements

- Oracle architecture: From mocks → real mainnet-derived + TWAP
- Liquidation flow: From 3-step manual → single automated transaction
- Gas efficiency: 50% reduction (1.2M → 600k)
- UX: Clear error messages on borrow failures
- Testing: Realistic price volatility scenarios enabled

### 🎯 Production Readiness

**Before Iteration 2:**
- ⚠️ Mock prices (unrealistic)
- ⚠️ Manual liquidation script (testnet only)
- ⚠️ Generic borrow errors (poor UX)
- ⚠️ Over-liquidation risk (script v1.0 bug)

**After Iteration 2:**
- ✅ Real mainnet-derived prices
- ✅ Production-grade TWAP fallback
- ✅ Automated single-tx liquidations
- ✅ Clear pre-transaction validations
- ✅ Proportional collateral distribution
- ✅ Mainnet-ready architecture (pending audit + governance)

### 🔧 Contract Version Updates

- LendingPool: v3.0 → v6.3.x (liquidity check + liquidate auto-transfer)
- CollateralManager: v1.1 → v2.0 (seizeCollateral function)
- Bot: v1.0 → v2.0 (updated gas estimates, no manual script)

### 📝 Documentation Updates

- Spec updated to reflect production-ready state
- All "planned for Iteration 2" sections resolved
- Oracle architecture: Detailed EVO_001 + EVO_003 implementation
- Liquidation flow: Updated diagrams for automated process
- Testing methodology: Added realistic volatility scenarios
- Roadmap: Marked Iteration 2 as complete

---

**Version:** v2.0.0
**Last Updated:** 2025-01-15
**Network:** Sepolia Testnet (Mainnet-Equivalent Architecture)
**Status:** Production-ready contracts, pending security audit + governance for mainnet
