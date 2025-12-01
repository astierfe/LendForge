# LendForge Architecture

Detailed technical architecture of the LendForge DeFi lending protocol.

## Table of Contents

- [System Overview](#system-overview)
- [Smart Contracts](#smart-contracts)
- [Oracle System](#oracle-system)
- [Frontend Architecture](#frontend-architecture)
- [Liquidation Bot](#liquidation-bot)
- [The Graph Subgraph](#the-graph-subgraph)
- [Data Flow Patterns](#data-flow-patterns)

---

## System Overview

```mermaid
graph TB
    subgraph Users["Users"]
        Borrower[Borrower]
        Liquidator[Liquidator Bot]
    end

    subgraph Frontend["Frontend Layer"]
        NextJS[Next.js 15 App]
        Wagmi[Wagmi + Viem]
        Apollo[Apollo Client]
    end

    subgraph Contracts["Smart Contract Layer (Sepolia)"]
        LP[LendingPool<br/>Borrow/Repay/Liquidate]
        CM[CollateralManager<br/>Deposits/Withdrawals]
        OA[OracleAggregator<br/>Price Feeds]
        CL[Chainlink Feeds]
        UNI[Uniswap V3 TWAP]
    end

    subgraph Indexing["Indexing Layer"]
        SG[The Graph Subgraph]
        GQL[GraphQL API]
    end

    subgraph Bot["Automation Layer"]
        Monitor[Position Monitor]
        Exec[Liquidation Executor]
        Profit[Profit Calculator]
    end

    Borrower --> NextJS
    NextJS --> Wagmi
    Wagmi --> LP
    Wagmi --> CM

    LP --> OA
    CM --> OA
    OA --> CL
    OA -.->|Fallback| UNI

    LP -.->|Events| SG
    CM -.->|Events| SG
    SG --> GQL
    Apollo --> GQL

    Monitor --> GQL
    Monitor --> Profit
    Profit --> Exec
    Exec --> LP
    Liquidator --> Monitor
```

---

## Smart Contracts

### Contract Interaction Diagram

```mermaid
graph LR
    subgraph Core["Core Contracts"]
        LP[LendingPool]
        CM[CollateralManager]
    end

    subgraph Oracle["Oracle Layer"]
        OA[OracleAggregator]
        PR[PriceRegistry]
        CLP[ChainlinkProvider]
        TWAP[UniswapV3Provider]
        MAN[ManualProvider]
    end

    subgraph Libs["Libraries"]
        HC[HealthCalculator]
        DT[DataTypes]
    end

    LP -->|getCollateralValue| CM
    LP -->|getPrice| OA
    CM -->|getPrice| OA

    OA --> PR
    PR --> CLP
    PR -.->|Fallback| TWAP
    PR -.->|Emergency| MAN

    LP --> HC
    CM --> HC
    HC --> DT
```

### Contract Addresses (Sepolia)

| Contract | Address | Version |
|----------|---------|---------|
| LendingPool | `0x504BD0CcAF75881CfCD8f432983A56A5C4e5Aa84` | v3.0 |
| CollateralManager | `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758` | v1.1 |
| OracleAggregator | `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe` | v3.1 |

### Key Functions

**LendingPool:**
- `borrow(uint256 amount)` — Borrow ETH against collateral
- `repay(uint256 amount)` — Repay borrowed ETH
- `liquidate(address user)` — Liquidate unhealthy position
- `getHealthFactor(address user)` — Get position health (scaled 100x)

**CollateralManager:**
- `depositETH()` — Deposit native ETH as collateral
- `depositToken(address asset, uint256 amount)` — Deposit ERC20
- `withdrawCollateral(address asset, uint256 amount)` — Withdraw collateral
- `getCollateralValueUSD(address user)` — Total collateral in USD

**OracleAggregator:**
- `getPrice(address asset)` — Get current price (8 decimals)
- `getPriceWithDeviation(address asset)` — Price + deviation data
- `setEmergencyMode(bool enabled)` — Pause on critical deviation

---

## Oracle System

### Dual-Oracle Architecture

```mermaid
graph TD
    Request[Price Request] --> Check{Cache Valid?}

    Check -->|Yes| Return[Return Cached Price]
    Check -->|No| Fetch[Fetch Fresh Prices]

    Fetch --> Primary[Chainlink Feed]
    Fetch --> Fallback[Uniswap V3 TWAP]

    Primary --> Deviation{Calculate Deviation}
    Fallback --> Deviation

    Deviation -->|< 5%| UseChainlink[Use Chainlink]
    Deviation -->|5-10%| UseTWAP[Use TWAP + Warning]
    Deviation -->|> 10%| Emergency[Emergency Mode]

    UseChainlink --> Cache[Cache 5 min]
    UseTWAP --> Cache
    Emergency --> Block[Block New Borrows]

    Cache --> Return
```

### Deviation Thresholds

| Deviation | Action | Operations Allowed |
|-----------|--------|-------------------|
| < 5% | Use Chainlink | All |
| 5-10% | Use TWAP + emit warning | All |
| > 10% | Emergency mode | Repay, Withdraw, Liquidate only |

### Price Sources

- **Chainlink (Primary):** Real ETH/USD feed on Sepolia
- **Uniswap V3 TWAP (Fallback):** 30-minute time-weighted average
- **Manual Provider (Emergency):** Admin-controlled injection

---

## Frontend Architecture

### Component Structure

```mermaid
graph TD
    subgraph Pages["App Router Pages"]
        Landing[Landing /]
        Dashboard[Dashboard /dashboard]
        Borrow[Borrow /borrow]
        Repay[Repay /repay]
        Deposit[Deposit /deposit]
        Withdraw[Withdraw /withdraw]
        Positions[Positions /positions]
    end

    subgraph Hooks["Custom Hooks"]
        OnChain[useOnChainPosition]
        HF[useHealthFactor]
        Prices[useOraclePrices]
        Positions_H[useUserPositions]
        Metrics[useGlobalMetrics]
    end

    subgraph Data["Data Sources"]
        Wagmi_D[Wagmi/Viem<br/>Real-time]
        Apollo_D[Apollo Client<br/>Historical]
    end

    Dashboard --> OnChain
    Dashboard --> HF
    Borrow --> HF
    Borrow --> Prices
    Positions --> Positions_H
    Landing --> Metrics

    OnChain --> Wagmi_D
    HF --> Wagmi_D
    Prices --> Wagmi_D
    Positions_H --> Apollo_D
    Metrics --> Apollo_D
```

### Data Source Strategy

| Data Type | Source | Refresh Rate | Use Case |
|-----------|--------|--------------|----------|
| Position balance | On-chain (Wagmi) | 5 seconds | Dashboard, Borrow, Repay |
| Health factor | On-chain (Wagmi) | 5 seconds | Real-time monitoring |
| Oracle prices | On-chain (Wagmi) | 5 seconds | Calculations |
| Position history | Subgraph (Apollo) | 5-30 seconds | Positions page |
| Global metrics | Subgraph (Apollo) | 5-30 seconds | Landing, Analytics |

### Key Hooks

```typescript
// Real-time position data
useOnChainPosition(address) → { collateral, borrowed, healthFactor }

// Health factor with status
useHealthFactor(address) → { hf, status, canBorrow, maxBorrow }

// Simulation before transaction
useBorrowSimulation(amount) → { resultingHF, isValid }
useWithdrawSimulation(asset, amount) → { resultingHF, maxWithdrawable }
```

---

## Liquidation Bot

### Bot Architecture

```mermaid
graph TD
    subgraph Scheduler["APScheduler"]
        Job[Liquidation Check<br/>Every 60s]
    end

    subgraph Services["Services"]
        Monitor[Position Monitor]
        Graph[Graph Client]
        Web3[Web3 Client]
        Profit[Profit Calculator]
        Exec[Liquidator]
    end

    subgraph Checks["Validation"]
        HF_Check{HF < 1.0?}
        Profit_Check{Profitable?}
        Gas_Check{Gas OK?}
    end

    Job --> Monitor
    Monitor --> Graph
    Graph -->|Risky Positions| Monitor
    Monitor --> Web3
    Web3 -->|On-chain HF| HF_Check

    HF_Check -->|Yes| Profit
    HF_Check -->|No| Skip[Skip]

    Profit --> Profit_Check
    Profit_Check -->|Yes| Gas_Check
    Profit_Check -->|No| Skip

    Gas_Check -->|Yes| Exec
    Gas_Check -->|No| Skip

    Exec -->|liquidate| Web3
```

### Profitability Formula

```python
# Liquidation profit calculation
collateral_seized_usd = debt_to_repay * (1 + LIQUIDATION_BONUS)
gas_cost_usd = gas_used * gas_price * eth_price
profit = collateral_seized_usd - debt_to_repay - gas_cost_usd

# Execution criteria
MIN_PROFIT_USD = 5.0
MAX_GAS_PRICE_GWEI = 50
```

### Bot Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `MONITOR_INTERVAL_SECONDS` | 60 | Check frequency |
| `MIN_PROFIT_USD` | 5.0 | Minimum profit threshold |
| `MAX_GAS_PRICE_GWEI` | 50 | Max gas price to execute |
| `HEALTH_FACTOR_THRESHOLD` | 1.0 | Liquidation trigger |

---

## The Graph Subgraph

### Entity Relationships

```mermaid
erDiagram
    User ||--o{ Position : has
    User ||--o{ UserCollateral : owns
    Position ||--o{ Transaction : contains

    User {
        string id PK
        BigInt totalCollateralUSD
        BigInt totalBorrowed
        Int activePositions
        Int liquidationCount
    }

    Position {
        string id PK
        string user FK
        BigInt borrowed
        BigInt totalCollateralUSD
        BigDecimal healthFactor
        PositionStatus status
        BigInt createdAt
        BigInt updatedAt
    }

    UserCollateral {
        string id PK
        string user FK
        string asset
        BigInt amount
        BigInt valueUSD
    }

    Transaction {
        string id PK
        string position FK
        TransactionType type
        BigInt amount
        BigInt timestamp
    }
```

### Position Status Flow

```mermaid
stateDiagram-v2
    [*] --> INACTIVE: Deposit Collateral
    INACTIVE --> ACTIVE: Borrow ETH
    ACTIVE --> ACTIVE: Partial Repay
    ACTIVE --> REPAID: Full Repay
    ACTIVE --> LIQUIDATED: HF < 1.0
    REPAID --> [*]
    LIQUIDATED --> [*]
```

### Event Handlers

| Event | Handler | Entities Updated |
|-------|---------|-----------------|
| `CollateralDeposited` | `handleCollateralDeposited` | User, UserCollateral, GlobalMetric |
| `CollateralWithdrawn` | `handleCollateralWithdrawn` | User, UserCollateral, GlobalMetric |
| `Borrowed` | `handleBorrowed` | User, Position, GlobalMetric |
| `Repaid` | `handleRepaid` | User, Position |
| `Liquidated` | `handleLiquidated` | User, Position, Liquidation |

---

## Data Flow Patterns

### Borrow Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant LendingPool
    participant CollateralManager
    participant OracleAggregator
    participant Subgraph

    User->>Frontend: Enter borrow amount
    Frontend->>Frontend: useBorrowSimulation()
    Frontend->>LendingPool: getHealthFactor()
    Frontend->>OracleAggregator: getPrice(ETH)
    Frontend-->>User: Show resulting HF

    User->>Frontend: Confirm borrow
    Frontend->>LendingPool: borrow(amount)
    LendingPool->>CollateralManager: getCollateralValueUSD(user)
    CollateralManager->>OracleAggregator: getPrice(assets)
    LendingPool->>LendingPool: Validate HF > 1.0
    LendingPool->>User: Transfer ETH
    LendingPool-->>Subgraph: Emit Borrowed event

    Subgraph->>Subgraph: Update Position entity
    Frontend->>Subgraph: Refetch positions
    Frontend-->>User: Show updated position
```

### Liquidation Flow

```mermaid
sequenceDiagram
    participant Bot
    participant Subgraph
    participant LendingPool
    participant CollateralManager
    participant Liquidator

    loop Every 60 seconds
        Bot->>Subgraph: Query risky positions
        Subgraph-->>Bot: Positions with HF < 1.5

        loop For each position
            Bot->>LendingPool: getHealthFactor(user)
            LendingPool-->>Bot: Current HF

            alt HF < 1.0
                Bot->>Bot: Calculate profit
                alt Profitable
                    Bot->>LendingPool: liquidate(user)
                    LendingPool->>CollateralManager: seizeCollateral()
                    CollateralManager->>Liquidator: Transfer seized assets
                    LendingPool-->>Subgraph: Emit Liquidated event
                end
            end
        end
    end
```

---

## Known Limitations

### MVP Workarounds

| ID | Issue | Workaround | Status |
|----|-------|-----------|--------|
| ANO_001 | `globalMetric.activePositions` always 0 | Count users with `activePositions > 0` | Documented |
| ANO_003 | `UserCollateral.valueUSD` stores total | Calculate `amount × price` client-side | Applied |
| ANO_009 | Cross-user data contamination | Centralized helpers + disabled cache | Resolved |

### Pre-Mainnet Requirements

- [ ] Professional security audit
- [ ] Multi-sig admin wallet
- [ ] DAO governance framework
- [ ] Interest rate model
- [ ] Circuit breakers (TVL caps)

---

## Resources

- **Subgraph Playground:** [TheGraph Studio](https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest)
- **Contract Explorer:** [Sepolia Etherscan](https://sepolia.etherscan.io)
- **Known Issues:** `/_docs/KNOWN_ISSUES_ANO.json`
