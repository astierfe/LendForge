# LendForge Smart Contracts Reference

Complete function reference for all LendForge smart contracts.

## Table of Contents

- [LendingPool](#lendingpool)
- [CollateralManager](#collateralmanager)
- [OracleAggregator](#oracleaggregator)
- [PriceRegistry](#priceregistry)
- [ManualPriceProvider](#manualpriceprovider)
- [Mock Providers](#mock-providers)

---

## LendingPool

**Address:** `0x504BD0CcAF75881CfCD8f432983A56A5C4e5Aa84`
**Version:** v3.0

Core lending contract for borrowing, repaying, and liquidating positions.

### User Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `borrow` | `borrow(uint256 amount) external` | Borrow ETH against deposited collateral |
| `repay` | `repay() external payable` | Repay borrowed ETH (accepts excess, refunds) |
| `liquidate` | `liquidate(address user) external payable` | Liquidate unhealthy position (HF < 1.0) |

### View Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getPosition` | `getPosition(address user)` | `Position` | User's position data |
| `getHealthFactor` | `getHealthFactor(address user)` | `uint256` | Health factor (scaled 100x) |
| `getCollateralValueUSD` | `getCollateralValueUSD(address user)` | `uint256` | Total collateral in USD |
| `getBorrowedAmount` | `getBorrowedAmount(address user)` | `uint256` | Current borrowed amount |
| `getMaxBorrowAmount` | `getMaxBorrowAmount(address user)` | `uint256` | Remaining borrow capacity |
| `getUserCollaterals` | `getUserCollaterals(address user)` | `(address[], uint256[])` | Collateral assets and amounts |
| `getCurrentBorrowRate` | `getCurrentBorrowRate()` | `uint256` | Base borrow rate |

### Admin Functions (onlyOwner)

| Function | Signature | Description |
|----------|-----------|-------------|
| `setCollateralManager` | `setCollateralManager(address _manager)` | Update CollateralManager address |
| `pause` | `pause()` | Pause borrow/liquidate operations |
| `unpause` | `unpause()` | Resume operations |
| `emergencyWithdraw` | `emergencyWithdraw()` | Withdraw all ETH (emergency only) |
| `transferOwnership` | `transferOwnership(address newOwner)` | Transfer contract ownership |

### Events

```solidity
event Borrowed(address indexed user, uint256 amount, uint256 healthFactor);
event Repaid(address indexed user, uint256 amount, uint256 remaining);
event Liquidated(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);
```

### Modifiers

- `whenNotPaused` - Blocks function when paused
- `notInEmergency` - Blocks function during oracle emergency mode

---

## CollateralManager

**Address:** `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758`
**Version:** v1.1

Manages multi-collateral deposits and withdrawals.

### User Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `depositETH` | `depositETH() external payable` | Deposit ETH as collateral |
| `depositERC20` | `depositERC20(address asset, uint256 amount)` | Deposit ERC20 token as collateral |
| `withdrawETH` | `withdrawETH(uint256 amount)` | Withdraw ETH collateral |
| `withdrawERC20` | `withdrawERC20(address asset, uint256 amount)` | Withdraw ERC20 collateral |

### View Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getCollateralValueUSD` | `getCollateralValueUSD(address user)` | `uint256` | Total collateral in USD |
| `getUserCollaterals` | `getUserCollaterals(address user)` | `(address[], uint256[], uint256[])` | Assets, amounts, USD values |
| `getUserCollateralBalance` | `getUserCollateralBalance(address user, address asset)` | `uint256` | Balance of specific asset |
| `getUserAssets` | `getUserAssets(address user)` | `address[]` | List of deposited assets |
| `getAssetConfig` | `getAssetConfig(address asset)` | `CollateralConfig` | Asset configuration |
| `getSupportedAssets` | `getSupportedAssets()` | `address[]` | All supported assets |
| `isAssetSupported` | `isAssetSupported(address asset)` | `bool` | Check if asset enabled |
| `getMaxBorrowValue` | `getMaxBorrowValue(address user)` | `uint256` | Max borrow based on LTV |

### Admin Functions (onlyOwner)

| Function | Signature | Description |
|----------|-----------|-------------|
| `addAsset` | `addAsset(address, string, uint256, uint256, uint256, uint8)` | Add supported collateral asset |
| `updateAssetConfig` | `updateAssetConfig(address, uint256, uint256, uint256)` | Update asset parameters |
| `setAssetEnabled` | `setAssetEnabled(address asset, bool enabled)` | Enable/disable asset |
| `transferOwnership` | `transferOwnership(address newOwner)` | Transfer ownership |

### CollateralConfig Struct

```solidity
struct CollateralConfig {
    uint256 ltv;                    // Loan-to-Value (66% for ETH, 90% for stables)
    uint256 liquidationThreshold;   // Liquidation threshold (83% ETH, 95% stables)
    uint256 liquidationPenalty;     // Penalty (10% ETH, 5% stables)
    uint8 decimals;                 // Token decimals
    bool enabled;                   // Is asset enabled
    string symbol;                  // Token symbol
}
```

### Events

```solidity
event CollateralDeposited(address indexed user, address indexed asset, uint256 amount, uint256 valueUSD);
event CollateralWithdrawn(address indexed user, address indexed asset, uint256 amount);
event AssetAdded(address indexed asset, string symbol, uint256 ltv, uint256 liquidationThreshold);
```

---

## OracleAggregator

**Address:** `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe`
**Version:** v3.1

Aggregates prices from multiple providers with deviation detection.

### Public Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getPrice` | `getPrice(address asset)` | `int256` | Current price (8 decimals) |
| `getCachedPrice` | `getCachedPrice(address asset)` | `(int256, uint256, string)` | Price, timestamp, source |
| `getDeviationInfo` | `getDeviationInfo(address asset)` | `(bool, uint256, int256, int256)` | Deviation data |

### Admin Functions (onlyOwner)

| Function | Signature | Description |
|----------|-----------|-------------|
| `clearCache` | `clearCache(address asset)` | Clear price cache for asset |
| `clearDeviation` | `clearDeviation(address asset)` | Clear deviation data |
| `setEmergencyMode` | `setEmergencyMode(bool enabled, string reason)` | Enable/disable emergency mode |
| `setDeviationChecks` | `setDeviationChecks(bool enabled)` | Toggle deviation checking |
| `transferOwnership` | `transferOwnership(address newOwner)` | Transfer ownership |

### Constants

```solidity
uint256 public constant MAX_DEVIATION = 500;       // 5% (warning)
uint256 public constant CRITICAL_DEVIATION = 1000; // 10% (emergency)
uint256 public constant CACHE_DURATION = 5 minutes;
```

### Price Selection Logic

```
1. Fetch primary and fallback prices
2. Calculate deviation = |primary - fallback| / primary
3. If deviation < 5%: Use primary
4. If deviation 5-10%: Use fallback + emit warning
5. If deviation >= 10%: Use fallback + emergency mode
```

### Events

```solidity
event PriceUpdated(address indexed asset, int256 price, string source);
event DeviationWarning(address indexed asset, uint256 deviationBps, int256 primary, int256 fallback);
event CriticalDeviation(address indexed asset, uint256 deviationBps);
event EmergencyModeSet(bool enabled, string reason);
```

---

## PriceRegistry

**Address:** `0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED`
**Version:** v1.1

Routes price requests to appropriate providers.

### View Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getPrice` | `getPrice(address asset)` | `int256` | Price from configured provider |
| `getPrimaryProvider` | `getPrimaryProvider(address asset)` | `address` | Primary provider address |
| `getFallbackProvider` | `getFallbackProvider(address asset)` | `address` | Fallback provider address |
| `isSupported` | `isSupported(address asset)` | `bool` | Check if asset supported |
| `getSupportedAssets` | `getSupportedAssets()` | `address[]` | All supported assets |

### Admin Functions (onlyOwner)

| Function | Signature | Description |
|----------|-----------|-------------|
| `addAsset` | `addAsset(address, string, address, address, uint8)` | Add asset with providers |
| `updateAsset` | `updateAsset(address, address, address)` | Update provider addresses |
| `transferOwnership` | `transferOwnership(address newOwner)` | Transfer ownership |

### AssetConfig Struct

```solidity
struct AssetConfig {
    address primaryProvider;   // Primary price source
    address fallbackProvider;  // Fallback (can be address(0))
    bool enabled;
    uint8 decimals;
    string symbol;
}
```

---

## ManualPriceProvider

**Address:** `0x74DeeD10Ea5A8185dB1f572A81D7946a26b35680`

Generic manual price provider (implements IPriceProvider).

### View Functions

| Function | Signature | Returns | Description |
|----------|-----------|---------|-------------|
| `getPrice` | `getPrice()` | `int256` | Current price (8 decimals) |
| `isHealthy` | `isHealthy()` | `bool` | False if stale (>24h) or invalid |
| `description` | `description()` | `string` | Provider description |

### Admin Functions (onlyOwner)

| Function | Signature | Description |
|----------|-----------|-------------|
| `setPrice` | `setPrice(int256 _price)` | Update price (must be > 0) |
| `transferOwnership` | `transferOwnership(address newOwner)` | Transfer ownership |

### Constants

```solidity
uint256 public constant STALE_THRESHOLD = 24 hours;
```

---

## Mock Providers

### MockUSDCPriceProvider

**Address:** `0x92BF794C2e01707bcD8A6b089317645dF0A94D9D`

| Function | Signature | Description |
|----------|-----------|-------------|
| `setPrice` | `setPrice(int256 _price)` | Set USDC/USD price (onlyOwner) |
| `getPrice` | `getPrice()` | Get current price |
| `isHealthy` | `isHealthy()` | Check if price valid and fresh |
| `description` | `description()` | Returns "Mock USDC/USD" |

### MockDAIPriceProvider

**Address:** `0xB1547d572781A58Ae4DcC9Ad29CE92A57C94831c`

| Function | Signature | Description |
|----------|-----------|-------------|
| `setPrice` | `setPrice(int256 _price)` | Set DAI/USD price (onlyOwner) |
| `getPrice` | `getPrice()` | Get current price |
| `isHealthy` | `isHealthy()` | Check if price valid and fresh |
| `description` | `description()` | Returns "Mock DAI/USD" |

### MockETHFallbackProvider

**Address:** `0x97fC84B565f48EF31480c6bBd6677Df297A6AFD6`

Used in demo mode for testing deviation scenarios.

| Function | Signature | Description |
|----------|-----------|-------------|
| `setPrice` | `setPrice(int256 _price)` | Set ETH fallback price (onlyOwner) |
| `getPrice` | `getPrice()` | Get current price |
| `description` | `description()` | Returns "Mock ETH/USD Fallback" |

---

## IPriceProvider Interface

All price providers implement this interface:

```solidity
interface IPriceProvider {
    function getPrice() external view returns (int256);
    function isHealthy() external view returns (bool);
    function description() external view returns (string memory);
}
```

---

## Libraries

### HealthCalculator

```solidity
library HealthCalculator {
    function calculateHealthFactor(
        uint256 collateralValueUSD,
        uint256 debtValueUSD,
        uint256 liquidationThreshold
    ) internal pure returns (uint256);
}
```

**Formula:**
```
adjustedCollateral = collateralValueUSD × liquidationThreshold / 100
healthFactor = adjustedCollateral × 100 / debtValueUSD
```

### DataTypes

```solidity
library DataTypes {
    uint256 constant LTV = 66;                      // Default LTV
    uint256 constant LIQUIDATION_THRESHOLD = 83;   // Global threshold
    uint256 constant LIQUIDATION_BONUS = 10;       // 10% bonus
    uint256 constant BASE_RATE = 5;                // 5% base rate
    uint256 constant PRECISION = 100;
}
```

---

## Contract Addresses Summary

| Contract | Address |
|----------|---------|
| LendingPool | `0x504BD0CcAF75881CfCD8f432983A56A5C4e5Aa84` |
| CollateralManager | `0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758` |
| OracleAggregator | `0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe` |
| PriceRegistry | `0x43BcA40deF9Ec42469b6dE95dCBfa38d58584aED` |
| MockUSDC Token | `0xC47095AD18C67FBa7E46D56BDBB014901f3e327b` |
| MockDAI Token | `0x2FA332E8337642891885453Fd40a7a7Bb010B71a` |
| MockUSDC Provider | `0x92BF794C2e01707bcD8A6b089317645dF0A94D9D` |
| MockDAI Provider | `0xB1547d572781A58Ae4DcC9Ad29CE92A57C94831c` |
| MockETH Fallback | `0x97fC84B565f48EF31480c6bBd6677Df297A6AFD6` |
