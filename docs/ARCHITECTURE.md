# LendForge Architecture (Iteration 1 - MVP)

Technical architecture of the LendForge DeFi lending protocol with mock oracle system.

## Table of Contents

- [System Overview](#system-overview)
- [Smart Contracts](#smart-contracts)
- [Oracle System (Mock)](#oracle-system-mock)
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
        LiqBot[Liquidator Bot]
        Owner[Contract Owner]
    end

    subgraph Frontend["Frontend Layer"]
        NextJS[Next.js 15 App]
        Wagmi[Wagmi + Viem]
        Apollo[Apollo Client]
    end

    subgraph Contracts["Smart Contract Layer (Sepolia)"]
        LP[LendingPool<br/>Borrow/Repay/Liquidate]
        CM[CollateralManager<br/>Deposits/Withdrawals]
        OA[OracleAggregator<br/>Price Selection]
        PR[PriceRegistry<br/>Asset Router]
    end

    subgraph Oracles["Mock Oracle Layer"]
        MockUSDC[MockUSDC Provider]
        MockDAI[MockDAI Provider]
        MockETH[MockETH Fallback]
    end

    subgraph Indexing["Indexing Layer"]
        SG[The Graph Subgraph]
        GQL[GraphQL API]
    end

    subgraph Bot["Automation Layer"]
        Monitor[Position Monitor]
        Exec[Liquidation Executor]
    end

    Borrower --> NextJS
    Owner -->|setPrice| MockUSDC & MockDAI
    NextJS --> Wagmi
    Wagmi --> LP & CM

    LP --> OA
    CM --> OA
    OA --> PR
    PR --> MockUSDC & MockDAI & MockETH

    LP & CM -.->|Events| SG
    SG --> GQL
    Apollo --> GQL

    Monitor --> GQL
    Monitor --> Exec
    Exec --> LP
    LiqBot --> Monitor
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
    end

    subgraph Mocks["Mock Providers (MVP)"]
        MU[MockUSDCProvider]
        MD[MockDAIProvider]
        ME[MockETHFallback]
    end

    subgraph Libs["Libraries"]
        HC[HealthCalculator]
        DT[DataTypes]
    end

    LP -->|getCollateralValue| CM
    LP -->|getPrice| OA
    CM -->|getPrice| OA

    OA --> PR
    PR --> MU & MD & ME

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
| PriceRegistry | `0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED` | v1.1 |

### Mock Tokens

| Token | Address | Decimals | Description |
|-------|---------|----------|-------------|
| MockUSDC | `0xC47095AD18C67FBa7E46D56BDBB014901f3e327b` | 6 | Custom ERC20 with mint() |
| MockDAI | `0x2FA332E8337642891885453Fd40a7a7Bb010B71a` | 18 | Custom ERC20 with mint() |
| ETH | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | 18 | Native (virtual address) |

---

## Oracle System (Mock)

### MVP Architecture

In Iteration 1, prices are **manually set by the contract owner**. This allows testing of:
- Liquidation flows with controlled price movements
- Deviation detection logic
- Emergency mode triggers

```mermaid
graph TD
    subgraph Request["Price Request Flow"]
        App[Frontend/Contract] --> OA[OracleAggregator]
        OA --> Check{Cache Valid?}
        Check -->|Yes| Return[Return Cached]
        Check -->|No| PR[PriceRegistry]
    end

    subgraph Providers["Mock Providers"]
        PR --> Primary[Primary Provider]
        PR --> Fallback[Fallback Provider]
    end

    subgraph Deviation["Deviation Check"]
        Primary --> Calc{Calculate Deviation}
        Fallback --> Calc
        Calc -->|< 5%| UsePrimary[Use Primary]
        Calc -->|5-10%| UseFallback[Use Fallback + Warning]
        Calc -->|> 10%| Emergency[Emergency Mode]
    end

    subgraph Control["Owner Control (MVP)"]
        Owner[Contract Owner]
        Owner -->|setPrice| MockUSDC[MockUSDCProvider]
        Owner -->|setPrice| MockDAI[MockDAIProvider]
        Owner -->|setPrice| MockETH[MockETHFallback]
    end
```

### Price Provider Configuration

| Asset | Primary Provider | Fallback Provider |
|-------|-----------------|-------------------|
| ETH | Chainlink ETH/USD (real) | MockETHFallback (demo) |
| USDC | MockUSDCProvider | None |
| DAI | MockDAIProvider | None |

### Deviation Thresholds

| Deviation | Action | Operations |
|-----------|--------|------------|
| < 5% | Use primary price | All allowed |
| 5-10% | Use fallback + emit warning | All allowed |
| > 10% | Emergency mode | Repay, Withdraw, Liquidate only |

### Testing Deviation (MVP)

```solidity
// Owner simulates price deviation for testing
MockDAIProvider.setPrice(1.05e8);  // DAI at $1.05 (5% deviation)
// OracleAggregator detects deviation, uses fallback

MockDAIProvider.setPrice(1.15e8);  // DAI at $1.15 (15% deviation)
// OracleAggregator triggers emergency mode
```

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

    Dashboard --> OnChain & HF
    Borrow --> HF & Prices
    Positions --> Positions_H
    Landing --> Metrics

    OnChain & HF & Prices --> Wagmi_D
    Positions_H & Metrics --> Apollo_D
```

### Data Source Strategy

| Data Type | Source | Refresh | Use Case |
|-----------|--------|---------|----------|
| Position balance | On-chain (Wagmi) | 5s | Dashboard, Borrow, Repay |
| Health factor | On-chain (Wagmi) | 5s | Real-time monitoring |
| Oracle prices | On-chain (Wagmi) | 5s | Calculations |
| Position history | Subgraph (Apollo) | 5-30s | Positions page |
| Global metrics | Subgraph (Apollo) | 5-30s | Landing, Analytics |

---

## Liquidation Bot

### Bot Architecture

```mermaid
graph TD
    subgraph Scheduler["APScheduler"]
        Job1[health_monitor<br/>Every 30s]
        Job2[liquidation_check<br/>Every 60s]
        Job3[price_sync<br/>Every 5min]
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
    end

    Job2 --> Monitor
    Monitor --> Graph
    Graph -->|Risky Positions| Monitor
    Monitor --> Web3
    Web3 -->|On-chain HF| HF_Check

    HF_Check -->|Yes| Profit
    HF_Check -->|No| Skip[Skip]

    Profit --> Profit_Check
    Profit_Check -->|Yes| Exec
    Profit_Check -->|No| Skip

    Exec -->|liquidate| Web3
```

### Profitability Formula

```python
collateral_seized_usd = debt_to_repay * (1 + LIQUIDATION_BONUS)
gas_cost_usd = gas_used * gas_price * eth_price
profit = collateral_seized_usd - debt_to_repay - gas_cost_usd

# Execution criteria
MIN_PROFIT_USD = 5.0
MAX_GAS_PRICE_GWEI = 50
```

### Background Jobs

| Job | Interval | Purpose |
|-----|----------|---------|
| `health_monitor` | 30s | Log risky positions |
| `liquidation_check` | 60s | Execute liquidations |
| `price_sync` | 5min | Sync oracle prices |

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
    }

    Position {
        string id PK
        string user FK
        BigInt borrowed
        BigDecimal healthFactor
        PositionStatus status
    }

    UserCollateral {
        string id PK
        string user FK
        string asset
        BigInt amount
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
| `CollateralDeposited` | `handleCollateralDeposited` | User, UserCollateral |
| `CollateralWithdrawn` | `handleCollateralWithdrawn` | User, UserCollateral |
| `Borrowed` | `handleBorrowed` | User, Position |
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
    participant MockProvider

    User->>Frontend: Enter borrow amount
    Frontend->>LendingPool: getHealthFactor()
    LendingPool->>CollateralManager: getCollateralValueUSD()
    CollateralManager->>OracleAggregator: getPrice(asset)
    OracleAggregator->>MockProvider: getPrice()
    MockProvider-->>OracleAggregator: price (8 decimals)
    OracleAggregator-->>CollateralManager: price
    CollateralManager-->>LendingPool: collateral USD
    LendingPool-->>Frontend: health factor
    Frontend-->>User: Show resulting HF

    User->>Frontend: Confirm borrow
    Frontend->>LendingPool: borrow(amount)
    LendingPool->>LendingPool: Validate HF > 1.0
    LendingPool->>User: Transfer ETH
    LendingPool-->>Subgraph: Emit Borrowed event
```

### Liquidation Flow

```mermaid
sequenceDiagram
    participant Bot
    participant Subgraph
    participant LendingPool
    participant CollateralManager

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
                    LendingPool->>CollateralManager: Transfer collateral
                    LendingPool-->>Subgraph: Emit Liquidated event
                end
            end
        end
    end
```

---

## Known Limitations (MVP)

### Iteration 1 Constraints

| Limitation | Description | Iteration 2 Solution |
|------------|-------------|---------------------|
| Mock Oracles | Prices set manually by owner | Real Chainlink + Uniswap injection |
| Mock Tokens | Custom ERC20 (not real stablecoins) | Same tokens, real prices |
| No TWAP | No time-weighted average prices | Uniswap V3 TWAP integration |
| Centralized | Owner controls all prices | Automated price feeds |

### Documented Workarounds

See `_docs/KNOWN_ISSUES_ANO.json` for:
- ANO_001: Active positions count workaround
- ANO_002: USDC decimal override
- ANO_003: USD value calculation
- ANO_009: Cross-user data contamination fix

---

## Resources

- **Subgraph:** [TheGraph Studio](https://api.studio.thegraph.com/query/122308/lendforge-v-4/version/latest)
- **Explorer:** [Sepolia Etherscan](https://sepolia.etherscan.io)
- **Iteration 2:** [docs/iteration2/](./iteration2/)
