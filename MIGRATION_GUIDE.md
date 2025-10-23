# LendForge Migration Guide v3.0

**Upgrading from LendingPoolV2 to LendForge v3.1 Multi-Collateral System**

---

## Overview

This guide covers migrating your LendForge project from the previous single-collateral system (LendingPoolV2) to the new multi-collateral architecture with advanced oracle fallback mechanisms.

**Migration Target:** LendForge v3.1 deployed on Sepolia testnet
**Current Status:** All smart contracts deployed and functional
**Migration Required:** Python bot + The Graph subgraph

---

## 📊 Contract Architecture Changes

### Old System (Deprecated)
```
LendingPoolV2 → SimpleOracle → MockChainlinkFeed
```

### New System (v3.1)
```
LendingPool v3.0 → OracleAggregator v3.1 → PriceRegistry → Multiple Providers
                 → CollateralManager v1.1 → Multi-asset support
```

---

## 🏗️ Smart Contract Deployment Status

### ✅ Deployed Contracts (Sepolia)

| Contract | Address | Version | Status |
|----------|---------|---------|---------|
| **LFTKN Token** | `0x773349C9f052082e7c2d20feb0dECf3CF24c982d` | v1.0 | ✅ Active |
| **PriceRegistry** | `0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED` | v1.1 | ✅ Active |
| **OracleAggregator** | `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe` | v3.1 | ✅ Active |
| **CollateralManager** | `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758` | v1.1 | ✅ Active |
| **LendingPool** | `0x06AF08708B45968492078A1900124DaA832082cD` | v3.0 | ✅ Active |
| **StakingPool** | `0xC125385BB75B78568Fc5B0884F233B135dbd0020` | v1.0 | ✅ Active |
| **RewardDistributor** | `0xe749B8c31F0c4895baB4e4B94CB2b0049cbe7c24` | v1.0 | ✅ Active |

### ❌ Deprecated Contracts
| Contract | Address | Status |
|----------|---------|--------|
| **LendingPoolV2** | `0x16CbF8825A11eAa25DA636E5bC9202190D4E8c5B` | 🚫 Deprecated |
| **SimpleOracle** | `0x4eC7F58b90A2aEAb6206ae62f8494b5b7E6aAfcF` | 🚫 Deprecated |
| **MockChainlinkFeed** | `0x842a3860f3b20Bcd430d9138BCee42bAbf155fFf` | 🚫 Deprecated |

---

## 🔧 Part 1: Python Bot Migration

### 1.1 Extract New ABI Files

**Required ABIs to extract from Foundry build artifacts:**

```bash
# Navigate to project root
cd C:\_Felix\projet\LendForge

# Extract ABIs from Foundry artifacts
mkdir -p bot/abis/

# Core contracts
cp out/LendingPool.sol/LendingPool.json bot/abis/
cp out/CollateralManager.sol/CollateralManager.json bot/abis/
cp out/OracleAggregator.sol/OracleAggregator.json bot/abis/
cp out/PriceRegistry.sol/PriceRegistry.json bot/abis/

# Token contracts
cp out/LFTKN.sol/LFTKN.json bot/abis/
cp out/USDC.sol/MockERC20.json bot/abis/MockERC20.json
cp out/DAI.sol/MockERC20.json bot/abis/MockDAI.json

# Oracle providers
cp out/ChainlinkPriceProvider.sol/ChainlinkPriceProvider.json bot/abis/
cp out/MockUniswapFallbackProvider.sol/MockUniswapFallbackProvider.json bot/abis/
```

### 1.2 Update bot/src/config.py

**Replace old configuration with new multi-collateral setup:**

```python
# bot/src/config.py - v2.0 - Multi-collateral configuration
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Blockchain
    SEPOLIA_RPC_URL = os.getenv("SEPOLIA_RPC_URL")
    PRIVATE_KEY = os.getenv("PRIVATE_KEY")

    # ===== NEW CONTRACTS (v3.1) =====
    LENDING_POOL_ADDRESS = os.getenv("LENDING_POOL_ADDRESS")  # v3.0
    COLLATERAL_MANAGER_ADDRESS = os.getenv("COLLATERAL_MANAGER_ADDRESS")
    ORACLE_AGGREGATOR_ADDRESS = os.getenv("ORACLE_AGGREGATOR_ADDRESS")  # v3.1
    PRICE_REGISTRY_ADDRESS = os.getenv("PRICE_REGISTRY_ADDRESS")

    # Token addresses
    LFTKN_ADDRESS = os.getenv("LFTKN_ADDRESS")
    USDC_TOKEN_ADDRESS = os.getenv("USDC_TOKEN_ADDRESS")
    DAI_TOKEN_ADDRESS = os.getenv("DAI_TOKEN_ADDRESS")

    # Staking contracts
    STAKING_POOL_ADDRESS = os.getenv("STAKING_POOL_ADDRESS")
    REWARD_DISTRIBUTOR_ADDRESS = os.getenv("REWARD_DISTRIBUTOR_ADDRESS")

    # ===== DEPRECATED - REMOVE =====
    # ORACLE_ADDRESS = os.getenv("ORACLE_ADDRESS")  # OLD SimpleOracle
    # CHAINLINK_FEED_ADDRESS = os.getenv("CHAINLINK_FEED_ADDRESS")  # OLD

    # The Graph
    SUBGRAPH_URL = os.getenv("SUBGRAPH_URL")

    # Bot Configuration
    MONITOR_INTERVAL_SECONDS = int(os.getenv("MONITOR_INTERVAL_SECONDS", "60"))
    MIN_PROFIT_USD = float(os.getenv("MIN_PROFIT_USD", "5.0"))
    MAX_GAS_PRICE_GWEI = int(os.getenv("MAX_GAS_PRICE_GWEI", "50"))
    HEALTH_FACTOR_THRESHOLD = float(os.getenv("HEALTH_FACTOR_THRESHOLD", "1.0"))

    # Liquidator
    LIQUIDATOR_WALLET = os.getenv("LIQUIDATOR_WALLET")

    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    LOG_FILE = os.getenv("LOG_FILE", "logs/bot.log")
    LOG_MAX_BYTES = int(os.getenv("LOG_MAX_BYTES", "10485760"))
    LOG_BACKUP_COUNT = int(os.getenv("LOG_BACKUP_COUNT", "5"))

    # Flask
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    FLASK_PORT = int(os.getenv("FLASK_PORT", "5000"))

    # ===== NEW ABI PATHS =====
    LENDING_POOL_ABI_PATH = "abis/LendingPool.json"
    COLLATERAL_MANAGER_ABI_PATH = "abis/CollateralManager.json"
    ORACLE_AGGREGATOR_ABI_PATH = "abis/OracleAggregator.json"
    PRICE_REGISTRY_ABI_PATH = "abis/PriceRegistry.json"
    LFTKN_ABI_PATH = "abis/LFTKN.json"

    # ===== DEPRECATED - REMOVE =====
    # ORACLE_ABI_PATH = "../out/SimpleOracle.sol/SimpleOracle.json"  # OLD

    # ===== NEW MULTI-COLLATERAL CONSTANTS =====
    # Asset addresses for collateral tracking
    ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"  # Placeholder for ETH

    # Collateral configs (LTV ratios)
    COLLATERAL_CONFIGS = {
        ETH_ADDRESS: {
            "symbol": "ETH",
            "ltv": 66,  # 66% LTV
            "liquidation_threshold": 83,  # 83%
            "decimals": 18
        },
        # Will be populated with actual USDC/DAI addresses from env
    }

    # Constants
    LIQUIDATION_BONUS = 0.10  # 10%
    ETH_DECIMALS = 18
    USD_DECIMALS = 8  # Chainlink standard

    @classmethod
    def validate(cls):
        required = [
            "SEPOLIA_RPC_URL",
            "PRIVATE_KEY",
            "LENDING_POOL_ADDRESS",
            "COLLATERAL_MANAGER_ADDRESS",
            "ORACLE_AGGREGATOR_ADDRESS",
            "SUBGRAPH_URL",
            "LIQUIDATOR_WALLET"
        ]

        missing = [key for key in required if not getattr(cls, key)]

        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

        # Populate token addresses in collateral configs
        if cls.USDC_TOKEN_ADDRESS:
            cls.COLLATERAL_CONFIGS[cls.USDC_TOKEN_ADDRESS] = {
                "symbol": "USDC",
                "ltv": 90,
                "liquidation_threshold": 95,
                "decimals": 6
            }

        if cls.DAI_TOKEN_ADDRESS:
            cls.COLLATERAL_CONFIGS[cls.DAI_TOKEN_ADDRESS] = {
                "symbol": "DAI",
                "ltv": 90,
                "liquidation_threshold": 95,
                "decimals": 18
            }

        return True
```

### 1.3 Update bot/src/clients/web3_client.py

**Major changes needed:**

```python
# bot/src/clients/web3_client.py - v2.0 - Multi-collateral support
import json
from decimal import Decimal
from typing import Tuple, Optional, List, Dict
from web3 import Web3
from web3.exceptions import ContractLogicError
from eth_account import Account
from config import Config
from utils.logger import logger

class Web3Client:
    def __init__(self):
        self.w3 = Web3(Web3.HTTPProvider(Config.SEPOLIA_RPC_URL))

        if not self.w3.is_connected():
            raise ConnectionError("Failed to connect to Sepolia RPC")

        # Load ABIs
        with open(Config.LENDING_POOL_ABI_PATH) as f:
            lending_pool_abi = json.load(f)["abi"]

        with open(Config.COLLATERAL_MANAGER_ABI_PATH) as f:
            collateral_manager_abi = json.load(f)["abi"]

        with open(Config.ORACLE_AGGREGATOR_ABI_PATH) as f:
            oracle_aggregator_abi = json.load(f)["abi"]

        # Initialize contracts
        self.lending_pool = self.w3.eth.contract(
            address=Web3.to_checksum_address(Config.LENDING_POOL_ADDRESS),
            abi=lending_pool_abi
        )

        self.collateral_manager = self.w3.eth.contract(
            address=Web3.to_checksum_address(Config.COLLATERAL_MANAGER_ADDRESS),
            abi=collateral_manager_abi
        )

        self.oracle_aggregator = self.w3.eth.contract(
            address=Web3.to_checksum_address(Config.ORACLE_AGGREGATOR_ADDRESS),
            abi=oracle_aggregator_abi
        )

        # Setup account
        self.account = Account.from_key(Config.PRIVATE_KEY)
        logger.info(f"Web3Client initialized | wallet={self.account.address}")

    # ===== NEW METHODS FOR MULTI-COLLATERAL =====

    def get_asset_price(self, asset_address: str) -> int:
        """Get price for any supported asset via OracleAggregator"""
        try:
            price = self.oracle_aggregator.functions.getPrice(
                Web3.to_checksum_address(asset_address)
            ).call()
            logger.debug(f"Price for {asset_address[:10]}...: ${price / 10**8}")
            return price
        except Exception as e:
            logger.error(f"Failed to get price for {asset_address}: {e}")
            return 0

    def get_user_collaterals(self, user_address: str) -> List[Dict]:
        """Get all collateral assets for a user"""
        try:
            assets, amounts, _ = self.collateral_manager.functions.getUserCollaterals(
                Web3.to_checksum_address(user_address)
            ).call()

            collaterals = []
            for i, asset in enumerate(assets):
                if amounts[i] > 0:  # Only include non-zero balances
                    collaterals.append({
                        "asset": asset,
                        "amount": amounts[i],
                        "symbol": Config.COLLATERAL_CONFIGS.get(asset, {}).get("symbol", "UNKNOWN")
                    })

            return collaterals

        except Exception as e:
            logger.error(f"Failed to get user collaterals: {e}")
            return []

    def get_collateral_value_usd(self, user_address: str) -> int:
        """Get total USD value of user's collateral"""
        try:
            value_usd = self.collateral_manager.functions.getCollateralValueUSD(
                Web3.to_checksum_address(user_address)
            ).call()
            return value_usd
        except Exception as e:
            logger.error(f"Failed to get collateral value USD: {e}")
            return 0

    def get_max_borrow_value(self, user_address: str) -> int:
        """Get maximum borrowable amount for user"""
        try:
            max_borrow = self.collateral_manager.functions.getMaxBorrowValue(
                Web3.to_checksum_address(user_address)
            ).call()
            return max_borrow
        except Exception as e:
            logger.error(f"Failed to get max borrow value: {e}")
            return 0

    def get_position_onchain(self, user_address: str) -> Tuple[int, int, int]:
        """Get position data from both contracts"""
        try:
            # Get borrowed amount from LendingPool
            position = self.lending_pool.functions.getPosition(
                Web3.to_checksum_address(user_address)
            ).call()

            _, borrowed, last_update, _ = position

            # Get total collateral value from CollateralManager
            collateral_usd = self.get_collateral_value_usd(user_address)

            logger.debug(
                f"Position on-chain | user={user_address[:10]}... | "
                f"collateral_usd={collateral_usd} | borrowed={borrowed}"
            )
            return collateral_usd, borrowed, last_update

        except Exception as e:
            logger.error(f"Failed to get position on-chain: {e}")
            return 0, 0, 0

    def get_health_factor(self, user_address: str) -> int:
        """Get health factor from LendingPool"""
        try:
            hf = self.lending_pool.functions.getHealthFactor(
                Web3.to_checksum_address(user_address)
            ).call()
            return hf
        except Exception as e:
            logger.error(f"Failed to get health factor: {e}")
            return 999999

    # ===== KEEP EXISTING METHODS =====

    def estimate_gas_price(self) -> int:
        try:
            gas_price = self.w3.eth.gas_price
            gas_price_gwei = gas_price / 10**9

            if gas_price_gwei > Config.MAX_GAS_PRICE_GWEI:
                logger.warning(
                    f"Gas price too high: {gas_price_gwei:.2f} gwei "
                    f"(max: {Config.MAX_GAS_PRICE_GWEI})"
                )

            return gas_price

        except Exception as e:
            logger.error(f"Failed to estimate gas price: {e}")
            return 20 * 10**9  # Fallback 20 gwei

    def build_liquidation_tx(self, user_address: str, debt_amount: int) -> dict:
        user_checksum = Web3.to_checksum_address(user_address)

        tx = self.lending_pool.functions.liquidate(user_checksum).build_transaction({
            'from': self.account.address,
            'value': debt_amount,
            'gas': 500000,
            'gasPrice': self.estimate_gas_price(),
            'nonce': self.w3.eth.get_transaction_count(self.account.address),
            'chainId': 11155111  # Sepolia
        })

        return tx

    def execute_liquidation(
        self,
        user_address: str,
        debt_amount: int
    ) -> Optional[str]:
        try:
            logger.info(
                f"Building liquidation tx | user={user_address[:10]}... | "
                f"debt=${debt_amount / 10**8:.2f}"
            )

            tx = self.build_liquidation_tx(user_address, debt_amount)

            # Sign transaction
            signed_tx = self.account.sign_transaction(tx)

            tx_hash = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            tx_hash_hex = tx_hash.hex()

            logger.info(f"Liquidation tx sent | tx_hash={tx_hash_hex[:10]}...")

            # Wait for confirmation
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)

            if receipt.status == 1:
                logger.info(f"Liquidation confirmed | tx_hash={tx_hash_hex}")
                return tx_hash_hex
            else:
                logger.error(f"Liquidation failed | tx_hash={tx_hash_hex}")
                return None

        except ContractLogicError as e:
            logger.error(f"Contract reverted: {e}")
            return None
        except Exception as e:
            logger.error(f"Liquidation execution failed: {e}")
            return None

    def get_wallet_balance(self) -> Decimal:
        balance_wei = self.w3.eth.get_balance(self.account.address)
        return Decimal(balance_wei) / Decimal(10**18)

    # ===== REMOVE OLD METHODS =====
    # def get_eth_price(self) -> int:  # DEPRECATED - use get_asset_price()
```

### 1.4 Update Environment Variables

**Add to bot/.env:**

```bash
# ===== NEW CONTRACT ADDRESSES (v3.1) =====
LENDING_POOL_ADDRESS=0x06AF08708B45968492078A1900124DaA832082cD
COLLATERAL_MANAGER_ADDRESS=0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758
ORACLE_AGGREGATOR_ADDRESS=0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe
PRICE_REGISTRY_ADDRESS=0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED

# Token addresses
LFTKN_ADDRESS=0x773349C9f052082e7c2d20feb0dECf3CF24c982d
USDC_TOKEN_ADDRESS=0xC47095AD18C67FBa7E46D56BDBB014901f3e327b
DAI_TOKEN_ADDRESS=0x2FA332E8337642891885453Fd40a7a7Bb010B71a

# Staking
STAKING_POOL_ADDRESS=0xC125385BB75B58568Fc5B0884F233B135dbd0020
REWARD_DISTRIBUTOR_ADDRESS=0xe749B8c31F0c4895baB4e4B94CB2b0049cbe7c24

# ===== REMOVE OLD ADDRESSES =====
# ORACLE_ADDRESS=  # OLD SimpleOracle
# CHAINLINK_FEED_ADDRESS=  # OLD feed
```

---

## 🔍 Part 2: The Graph Subgraph Migration

### 2.1 Update Schema for Multi-Collateral

**Replace subgraph/schema.graphql:**

```graphql
# subgraph/schema.graphql - v3.0 - Multi-collateral schema

type User @entity(immutable: false) {
  id: ID!
  positions: [Position!]! @derivedFrom(field: "user")
  collaterals: [UserCollateral!]! @derivedFrom(field: "user")
  totalCollateralUSD: BigInt!
  totalBorrowed: BigInt!
  activePositions: Int!
  lifetimeDeposits: BigInt!
  lifetimeBorrows: BigInt!
  lifetimeRepayments: BigInt!
  liquidationCount: Int!
  createdAt: BigInt!
  updatedAt: BigInt!
}

type Position @entity(immutable: false) {
  id: ID!
  user: User!
  totalCollateralUSD: BigInt!  # From CollateralManager
  borrowed: BigInt!            # From LendingPool
  healthFactor: BigDecimal!
  status: PositionStatus!
  createdAt: BigInt!
  updatedAt: BigInt!
  closedAt: BigInt
  transactions: [Transaction!]! @derivedFrom(field: "position")
}

# NEW: Track individual collateral assets per user
type UserCollateral @entity(immutable: false) {
  id: ID!  # user-asset format
  user: User!
  asset: CollateralAsset!
  amount: BigInt!
  valueUSD: BigInt!
  updatedAt: BigInt!
}

# NEW: Supported collateral assets
type CollateralAsset @entity(immutable: false) {
  id: ID!  # Asset address
  symbol: String!
  decimals: Int!
  ltv: Int!  # Loan-to-value ratio
  liquidationThreshold: Int!
  enabled: Boolean!
  totalDeposited: BigInt!
  userCollaterals: [UserCollateral!]! @derivedFrom(field: "asset")
}

enum PositionStatus {
  ACTIVE
  REPAID
  LIQUIDATED
}

type Transaction @entity(immutable: false) {
  id: ID!
  position: Position!
  user: User!
  type: TransactionType!
  asset: Bytes  # NEW: Asset address for multi-collateral
  amount: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
  txHash: Bytes!
  gasUsed: BigInt
}

enum TransactionType {
  DEPOSIT_ETH      # NEW: Specific for ETH deposits
  DEPOSIT_ERC20    # NEW: Specific for ERC20 deposits
  BORROW
  REPAY
  WITHDRAW_ETH     # NEW: Specific for ETH withdrawals
  WITHDRAW_ERC20   # NEW: Specific for ERC20 withdrawals
  LIQUIDATION
}

type DailyMetric @entity(immutable: false) {
  id: ID!
  date: Int!
  totalTVL: BigInt!
  totalBorrowed: BigInt!
  utilizationRate: BigDecimal!
  activeUsers: Int!
  activePositions: Int!
  depositsCount: Int!
  borrowsCount: Int!
  repaymentsCount: Int!
  liquidationsCount: Int!
  volumeDeposited: BigInt!
  volumeBorrowed: BigInt!
  volumeRepaid: BigInt!
  # NEW: Per-asset metrics
  ethTVL: BigInt!
  usdcTVL: BigInt!
  daiTVL: BigInt!
}

type GlobalMetric @entity(immutable: false) {
  id: ID!
  totalUsers: Int!
  totalPositions: Int!
  activePositions: Int!
  totalVolumeDeposited: BigInt!
  totalVolumeBorrowed: BigInt!
  totalVolumeRepaid: BigInt!
  totalLiquidations: Int!
  currentTVL: BigInt!
  currentBorrowed: BigInt!
  allTimeHighTVL: BigInt!
  allTimeHighBorrowed: BigInt!
  # NEW: Multi-collateral totals
  totalETHDeposited: BigInt!
  totalUSDCDeposited: BigInt!
  totalDAIDeposited: BigInt!
  updatedAt: BigInt!
}

type Liquidation @entity(immutable: false) {
  id: ID!
  position: Position!
  user: User!
  liquidator: Bytes!
  debtRepaid: BigInt!
  collateralSeizedUSD: BigInt!  # NEW: USD value
  timestamp: BigInt!
  blockNumber: BigInt!
  txHash: Bytes!
  healthFactorBefore: BigDecimal!
}

# NEW: Oracle deviation tracking
type PriceDeviation @entity(immutable: false) {
  id: ID!  # asset-timestamp
  asset: Bytes!
  primaryPrice: BigInt!
  fallbackPrice: BigInt!
  deviationBps: BigInt!
  timestamp: BigInt!
  blockNumber: BigInt!
  emergencyTriggered: Boolean!
}
```

### 2.2 Update subgraph.yaml

**Key changes:**

```yaml
specVersion: 1.0.0
indexerHints:
  prune: auto
schema:
  file: ./schema.graphql
dataSources:
  # ===== NEW: LendingPool v3.0 =====
  - kind: ethereum
    name: LendingPool
    network: sepolia
    source:
      address: "0x06AF08708B45968492078A1900124DaA832082cD"  # NEW ADDRESS
      abi: LendingPool
      startBlock: 9362000  # UPDATE: Recent block
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - User
        - Position
        - Transaction
        - GlobalMetric
        - Liquidation
      abis:
        - name: LendingPool
          file: ./abis/LendingPool.json  # NEW ABI
      eventHandlers:
        - event: Borrowed(indexed address,uint256,uint256)
          handler: handleBorrowed
        - event: Repaid(indexed address,uint256,uint256)
          handler: handleRepaid
        - event: Liquidated(indexed address,indexed address,uint256,uint256)
          handler: handleLiquidated
      file: ./src/lending-pool.ts

  # ===== NEW: CollateralManager v1.1 =====
  - kind: ethereum
    name: CollateralManager
    network: sepolia
    source:
      address: "0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758"  # NEW CONTRACT
      abi: CollateralManager
      startBlock: 9362000  # UPDATE: Recent block
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - User
        - Position
        - UserCollateral
        - CollateralAsset
        - Transaction
        - GlobalMetric
      abis:
        - name: CollateralManager
          file: ./abis/CollateralManager.json  # NEW ABI
      eventHandlers:
        - event: CollateralDeposited(indexed address,indexed address,uint256,uint256)
          handler: handleCollateralDeposited
        - event: CollateralWithdrawn(indexed address,indexed address,uint256,uint256)
          handler: handleCollateralWithdrawn
        - event: AssetAdded(indexed address,string,uint256,uint256,uint256)
          handler: handleAssetAdded
      file: ./src/collateral-manager.ts

  # ===== NEW: OracleAggregator v3.1 =====
  - kind: ethereum
    name: OracleAggregator
    network: sepolia
    source:
      address: "0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe"  # NEW CONTRACT
      abi: OracleAggregator
      startBlock: 9362000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - PriceDeviation
      abis:
        - name: OracleAggregator
          file: ./abis/OracleAggregator.json  # NEW ABI
      eventHandlers:
        - event: DeviationWarning(indexed address,int256,int256,uint256)
          handler: handleDeviationWarning
        - event: CriticalDeviation(indexed address,int256,int256,uint256)
          handler: handleCriticalDeviation
        - event: EmergencyModeSet(bool,string)
          handler: handleEmergencyModeSet
      file: ./src/oracle-aggregator.ts

# ===== REMOVE OLD DATASOURCE =====
# LendingPoolV2 datasource - DELETE ENTIRE SECTION
```

### 2.3 New Event Signatures

**Events to index:**

#### CollateralManager Events:
```solidity
event CollateralDeposited(indexed address user, indexed address asset, uint256 amount, uint256 timestamp)
event CollateralWithdrawn(indexed address user, indexed address asset, uint256 amount, uint256 timestamp)
event AssetAdded(indexed address asset, string symbol, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationPenalty)
event AssetEnabled(indexed address asset, bool enabled)
```

#### LendingPool Events:
```solidity
event Borrowed(indexed address user, uint256 amount, uint256 healthFactor)
event Repaid(indexed address user, uint256 amount, uint256 remainingDebt)
event Liquidated(indexed address liquidator, indexed address user, uint256 debtRepaid, uint256 collateralSeizedUSD)
```

#### OracleAggregator Events:
```solidity
event DeviationWarning(indexed address asset, int256 primaryPrice, int256 fallbackPrice, uint256 deviationBps)
event CriticalDeviation(indexed address asset, int256 primaryPrice, int256 fallbackPrice, uint256 deviationBps)
event EmergencyModeSet(bool enabled, string reason)
event FallbackUsed(indexed address asset, int256 fallbackPrice, uint256 deviationBps, string reason)
```

---

## 📋 Part 3: Step-by-Step Migration Checklist

### Phase 1: Preparation
- [ ] **Backup current bot and subgraph code**
- [ ] **Extract new ABI files from Foundry artifacts**
  ```bash
  cd C:\_Felix\projet\LendForge
  mkdir -p bot/abis subgraph/abis
  # Copy ABIs as specified in section 1.1
  ```
- [ ] **Update .env with new contract addresses**
- [ ] **Verify all new contracts are deployed and functional**

### Phase 2: Bot Migration
- [ ] **Update bot/src/config.py**
  - Replace old contract addresses
  - Add new ABI paths
  - Add multi-collateral constants
- [ ] **Update bot/src/clients/web3_client.py**
  - Add multi-collateral methods
  - Update position tracking logic
  - Remove deprecated oracle methods
- [ ] **Update bot/src/services/position_monitor.py**
  - Integrate multi-collateral position checking
  - Update health factor calculation
- [ ] **Update bot/src/services/profit_calculator.py**
  - Account for multi-asset liquidation bonuses
- [ ] **Test bot connectivity**
  ```bash
  cd bot
  python src/main.py --test-mode
  ```

### Phase 3: Subgraph Migration
- [ ] **Update subgraph/schema.graphql** (new multi-collateral entities)
- [ ] **Update subgraph/subgraph.yaml** (new contracts and events)
- [ ] **Create new TypeScript handlers**
  - `src/collateral-manager.ts`
  - `src/oracle-aggregator.ts`
  - Update `src/lending-pool.ts`
- [ ] **Update ABI files in subgraph/abis/**
- [ ] **Test subgraph compilation**
  ```bash
  cd subgraph
  npm run codegen
  npm run build
  ```

### Phase 4: Deployment & Testing
- [ ] **Deploy new subgraph version**
  ```bash
  graph deploy --studio lendforge-v3
  ```
- [ ] **Verify subgraph syncing** (check recent block indexing)
- [ ] **Test bot with new subgraph endpoint**
- [ ] **Verify multi-collateral position tracking**
- [ ] **Test liquidation execution (if profitable positions exist)**

### Phase 5: Validation
- [ ] **Compare bot readings with on-chain data**
- [ ] **Verify subgraph query results match contract state**
- [ ] **Monitor for oracle deviation events**
- [ ] **Test emergency mode scenarios**
- [ ] **Validate profit calculations**

---

## 🔧 Part 4: Testing & Validation

### 4.1 Bot Testing Commands

```bash
# Test connectivity and configuration
cd bot
python src/main.py --dry-run

# Test multi-collateral position reading
curl http://localhost:5000/positions | jq

# Test oracle price fetching
curl http://localhost:5000/prices | jq

# Test health factor calculations
curl http://localhost:5000/health-factors | jq
```

### 4.2 Subgraph Testing Queries

**Test multi-collateral positions:**
```graphql
{
  positions(first: 5, orderBy: updatedAt, orderDirection: desc) {
    id
    user { id }
    totalCollateralUSD
    borrowed
    healthFactor
    status
    updatedAt
  }
}
```

**Test user collaterals:**
```graphql
{
  userCollaterals(first: 10) {
    id
    user { id }
    asset { symbol }
    amount
    valueUSD
  }
}
```

**Test oracle deviations:**
```graphql
{
  priceDeviations(first: 5, orderBy: timestamp, orderDirection: desc) {
    asset
    primaryPrice
    fallbackPrice
    deviationBps
    emergencyTriggered
    timestamp
  }
}
```

### 4.3 Expected Results

**Bot should display:**
- Multi-asset collateral breakdown per user
- Accurate health factors matching on-chain calculations
- Oracle price data from OracleAggregator
- Liquidation opportunities with multi-asset bonus calculations

**Subgraph should show:**
- Recent CollateralDeposited/Withdrawn events
- Borrowed/Repaid events from new LendingPool
- Accurate TVL calculations across all assets
- Oracle deviation warnings if price discrepancies occur

---

## ⚠️ Important Notes & Warnings

### Contract Architecture Changes
1. **Collateral is now managed by CollateralManager**, not LendingPool
2. **Prices come from OracleAggregator**, not SimpleOracle
3. **Health factors are calculated differently** with multi-asset support
4. **Liquidation mechanics include multi-asset seizure**

### Data Format Changes
1. **CollateralDeposited events now include asset parameter**
2. **Position data split across two contracts**
3. **Health factors may have different precision/calculation**
4. **Price feeds return different decimal formats**

### Breaking Changes
1. **Old LendingPoolV2 ABI will not work**
2. **SimpleOracle contract is deprecated**
3. **Event signatures have changed**
4. **Position tracking requires both contracts**

### Emergency Scenarios
1. **Oracle emergency mode can block new borrows**
2. **Price deviations >10% trigger automatic fallback**
3. **Liquidation profitability affected by multi-asset complexity**

---

## 🚀 Post-Migration Verification

### Success Criteria
- [ ] Bot detects positions from new contracts
- [ ] Subgraph indexes events from all three contracts
- [ ] Health factor calculations match on-chain values
- [ ] Oracle deviation tracking works
- [ ] Liquidation execution succeeds (when profitable)
- [ ] Multi-collateral TVL tracking accurate

### Common Issues & Solutions

**Issue: Bot can't read positions**
- *Solution: Verify LENDING_POOL_ADDRESS and COLLATERAL_MANAGER_ADDRESS in .env*

**Issue: Subgraph not syncing**
- *Solution: Check startBlock is recent, verify contract addresses in subgraph.yaml*

**Issue: Health factor mismatch**
- *Solution: Ensure using latest CollateralManager.getCollateralValueUSD() for calculations*

**Issue: Oracle price errors**
- *Solution: Check OracleAggregator is not in emergency mode, verify asset is supported*

---

## 📞 Support Resources

- **Smart Contract Documentation:** `contracts/README.md`
- **Bot Architecture:** `bot/poc5_context.md`
- **Test Coverage:** `test/` directory with 225+ tests
- **Oracle System:** Detailed specs in README.md "Oracle Fallback Strategy" section

**For issues:** Verify all contract addresses match .env file deployed addresses on Sepolia.

---

**Migration Guide v3.0 - LendForge Multi-Collateral System**
*Last Updated: Based on deployment status as of contracts v3.1*