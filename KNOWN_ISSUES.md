# Known Issues & Anomalies

**Project:** LendForge v5.2.0
**Last Updated:** January 30, 2025

This document tracks known bugs, anomalies, and technical debt that require future resolution.

---

## 🐛 Active Issues

### 1. Subgraph: `global.activePositions` Always Returns 0

**Status:** 🟡 Known Issue - Workaround Implemented
**Affected Component:** The Graph Subgraph (v4.11.1-fix-activePositions)
**Severity:** Low (workaround available)

**Description:**
The `globalMetric.activePositions` field in the subgraph always returns `0`, even when multiple users have active borrowing positions. However, `user.activePositions` works correctly (returns 0 or 1 per user).

**Root Cause:**
In the unified position model, positions are created during `CollateralDeposited` events (via `collateral-manager.ts`) before `Borrowed` events are processed (via `lending-pool.ts`). When `handleBorrowed()` is called, the position already exists with `borrowed = 0`, causing `isNewActivePosition = true`. However, the global counter increment happens in a different order during subgraph re-indexing, resulting in the counter remaining at 0.

**Impact:**
- Frontend cannot directly use `globalMetric.activePositions`
- Dashboard stats require manual calculation
- No impact on individual user position tracking

**Workaround (Frontend):**
Use a GraphQL query to count users with active positions:

```graphql
query GetGlobalMetrics {
  globalMetric(id: "global") {
    currentTVL
    currentBorrowed
    totalUsers
  }

  # Count active positions manually
  activeUsers: users(where: { activePositions_gt: 0 }) {
    id
  }
}
```

```typescript
// Calculate active positions count
const activePositionsCount = data.activeUsers.length
```

**Long-term Solution:**
- Option A: Refactor subgraph event handlers to properly track global counters
- Option B: Accept limitation and always calculate client-side
- Option C: Implement v6.0 multiple positions architecture (requires contract refactor)

**Related Files:**
- `subgraph/src/lending-pool.ts` (handleBorrowed)
- `subgraph/src/collateral-manager.ts` (handleCollateralDeposited)
- `frontend/lib/graphql/queries/metrics.ts`
- `frontend/app/page.tsx` (landing page stats)

**Attempted Fixes:**
- ❌ Increment `global.activePositions` in `handleBorrowed()` - caused regression (only 1 user indexed)
- ❌ Increment `global.totalPositions` in `collateral-manager.ts` - no effect
- ✅ Client-side calculation (current workaround)

---

### 2. Subgraph: Asset Decimals Incorrectly Hardcoded to 18

**Status:** 🟡 Known Issue - Frontend Workaround Implemented
**Affected Components:** The Graph Subgraph, Smart Contract Event, Frontend
**Severity:** Medium (causes display issues, requires workaround)

**Description:**
The subgraph stores `decimals = 18` for all collateral assets (ETH, USDC, DAI), regardless of their actual decimal precision. This causes USDC amounts (which use 6 decimals) to display incorrectly as 0.0000 instead of the correct value.

**Root Cause:**
Two-part issue:
1. **Smart Contract**: The `AssetAdded` event does not include the `decimals` parameter
   ```solidity
   // contracts/CollateralManager.sol
   event AssetAdded(
       address indexed asset,
       string symbol,
       uint256 ltv,
       uint256 liquidationThreshold,
       uint256 liquidationPenalty
       // ❌ Missing: uint8 decimals
   );
   ```

2. **Subgraph**: The `handleAssetAdded()` handler defaults to 18 decimals and cannot update it
   ```typescript
   // subgraph/src/collateral-manager.ts:134
   function getOrCreateCollateralAsset(assetAddress: Bytes): CollateralAsset {
     // ...
     asset.decimals = 18  // ❌ Hardcoded, never updated
   }
   ```

**Impact:**
- USDC amounts display as `0.0000` instead of correct value (e.g., `101.00`)
- Frontend calculations using `collateral.asset.decimals` are incorrect
- User confusion about deposited collateral amounts

**Workaround (Frontend):**
Hardcode asset decimals mapping in `frontend/hooks/useUserPosition.ts`:
```typescript
const ASSET_DECIMALS: Record<string, number> = {
  ETH: 18,
  USDC: 6,   // Override subgraph's incorrect value
  DAI: 18,
};

// Use in formatters
tokenToNumber: (amount: string, decimals: number, symbol?: string): number => {
  const actualDecimals = symbol && ASSET_DECIMALS[symbol]
    ? ASSET_DECIMALS[symbol]
    : decimals;
  return parseFloat(amount) / Math.pow(10, actualDecimals);
}
```

**Long-term Solution (Requires Redeployment):**
1. **Update Smart Contract** - Add `decimals` to `AssetAdded` event:
   ```solidity
   event AssetAdded(
       address indexed asset,
       string symbol,
       uint8 decimals,  // ✅ Add this
       uint256 ltv,
       uint256 liquidationThreshold,
       uint256 liquidationPenalty
   );
   ```

2. **Update Subgraph Handler** - Capture decimals from event:
   ```typescript
   export function handleAssetAdded(event: AssetAdded): void {
     let asset = getOrCreateCollateralAsset(event.params.asset)
     asset.symbol = event.params.symbol
     asset.decimals = event.params.decimals  // ✅ Add this
     asset.ltv = event.params.ltv.toI32()
     // ...
   }
   ```

3. **Redeploy**: Requires CollateralManager contract redeployment + subgraph reindex

**Related Files:**
- `contracts/CollateralManager.sol` (AssetAdded event)
- `subgraph/src/collateral-manager.ts` (handleAssetAdded)
- `frontend/hooks/useUserPosition.ts` (ASSET_DECIMALS workaround)
- `frontend/app/(authenticated)/test-hooks/page.tsx` (uses corrected formatter)

---

### 3. Subgraph: `UserCollateral.valueUSD` Stores Total Instead of Per-Asset Value

**Status:** 🔴 Active Bug - No Workaround
**Affected Component:** The Graph Subgraph (v4.1.1)
**Severity:** Medium (incorrect per-asset USD values)

**Description:**
The `UserCollateral.valueUSD` field stores the **total collateral value** of the user instead of the value for that specific asset. This causes confusion when displaying collateral breakdowns.

**Example:**
```
User has:
- 10,100 DAI    → valueUSD shows $10,207 (should be ~$10,101)
- 101 USDC      → valueUSD shows $201 (should be ~$101)
- 0.004 ETH     → valueUSD shows $217 (should be ~$10)
```

**Root Cause:**
The `calculateAssetValueUSD()` function calls `collateralManager.getCollateralValueUSD(user)`, which returns the **total** collateral value, not per-asset:

```typescript
// subgraph/src/collateral-manager.ts:38
let totalValueResult = collateralManager.try_getCollateralValueUSD(userAddress)
// ❌ Returns TOTAL for all assets, not just one!

userCollateral.valueUSD = totalValueResult.value  // Line 194
// ❌ Stores total instead of per-asset value
```

**Impact:**
- Individual `userCollateral.valueUSD` values are incorrect
- Cannot display accurate per-asset USD values in frontend
- User sees misleading collateral breakdown (e.g., "101 USDC = $201")
- **Note:** `user.totalCollateralUSD` is still correct

**Workaround:**
Currently **no clean workaround**. Options:
1. Ignore `userCollateral.valueUSD` and calculate manually (requires ETH price oracle)
2. Use only `user.totalCollateralUSD` (no per-asset breakdown)

**Long-term Solution:**
The smart contract doesn't have a function to get per-asset USD value. Need to add:

```solidity
// contracts/CollateralManager.sol
function getAssetValueUSD(address user, address asset)
    external
    returns (uint256)
{
    uint256 balance = userCollateral[user][asset];
    int256 price = oracle.getPrice(asset);
    CollateralConfig memory config = assetConfigs[asset];
    return _convertToUSD(balance, uint256(price), config.decimals);
}
```

Then update subgraph to call this new function.

**Related Files:**
- `subgraph/src/collateral-manager.ts` (calculateAssetValueUSD)
- `contracts/CollateralManager.sol` (missing getAssetValueUSD function)
- `frontend/app/(authenticated)/test-hooks/page.tsx` (shows bug warning)

---

### 4. Subgraph: `GlobalMetric.currentTVL` Incorrectly Adds Mixed Decimals

**Status:** 🟡 Known Issue - Frontend Workaround Implemented
**Affected Component:** The Graph Subgraph (v4.1.1), Frontend Dashboard
**Severity:** High (incorrect TVL display)

**Description:**
The `globalMetric.currentTVL` field stores an incorrect value because it adds raw token amounts with different decimal formats without normalization. This causes astronomically large TVL values (e.g., "$101,000,040,000,031.02" instead of "$13,210.00").

**Root Cause:**
In `subgraph/src/collateral-manager.ts:145-175`, the `updateGlobalTVLByAsset()` function directly adds token amounts to `currentTVL`:

```typescript
function updateGlobalTVLByAsset(global: GlobalMetric, asset: Bytes, amountChange: BigInt, isDeposit: boolean): void {
  if (asset.equals(ETH_ADDRESS)) {
    // amountChange is in 18 decimals (e.g., 4000000000000000 = 0.004 ETH)
    global.currentTVL = global.currentTVL.plus(amountChange)
  } else if (asset.equals(USDC_ADDRESS)) {
    // amountChange is in 6 decimals (e.g., 3101000000 = 3101 USDC)
    global.currentTVL = global.currentTVL.plus(amountChange)
  } else if (asset.equals(DAI_ADDRESS)) {
    // amountChange is in 18 decimals (e.g., 10100000000000000000000 = 10,100 DAI)
    global.currentTVL = global.currentTVL.plus(amountChange)
  }
}
```

This sums: `4000000000000000 (ETH) + 3101000000 (USDC) + 10100000000000000000000 (DAI) = 10100004000003101000000`

**Example Bug:**
```
Actual deposits:
- 0.004 ETH    → 0.004 * 1e18 = 4000000000000000
- 3,101 USDC   → 3101 * 1e6   = 3101000000
- 10,100 DAI   → 10100 * 1e18 = 10100000000000000000000

Subgraph incorrectly adds these:
currentTVL = 10100004000003101000000

Frontend was incorrectly parsing as: $10100004000003101000000 / 1e8 = $101,000,040,000,031.01
```

**Impact:**
- Dashboard displays astronomically incorrect TVL values
- Cannot use `globalMetric.currentTVL` for any calculations
- User sees confusing/broken statistics

**Workaround (Frontend):**
Calculate TVL manually from individual asset totals in `frontend/components/dashboard/TVLOverviewCard.tsx:57-73`:

```typescript
// Parse each asset with correct decimals
const ethDeposited = parseFloat(globalMetrics.totalETHDeposited) / 1e18;
const usdcDeposited = parseFloat(globalMetrics.totalUSDCDeposited) / 1e6;
const daiDeposited = parseFloat(globalMetrics.totalDAIDeposited) / 1e18;

// Convert to USD
const ethValueUSD = ethDeposited * ETH_PRICE;
const usdcValueUSD = usdcDeposited * 1.0;
const daiValueUSD = daiDeposited * 1.0;

// Calculate correct total
const totalTVL = ethValueUSD + usdcValueUSD + daiValueUSD;
```

**Long-term Solution:**
The subgraph should convert each asset to USD (8 decimals) before adding to `currentTVL`:

```typescript
function updateGlobalTVLByAsset(global: GlobalMetric, asset: Bytes, amountChange: BigInt, isDeposit: boolean): void {
  // Get asset price from oracle (returns 8 decimals)
  let priceUSD = getAssetPriceUSD(asset)

  // Convert amount to USD with proper decimals
  let assetConfig = CollateralAsset.load(asset.toHexString())!
  let valueUSD = convertToUSD(amountChange, priceUSD, assetConfig.decimals)

  if (isDeposit) {
    global.currentTVL = global.currentTVL.plus(valueUSD)
  } else {
    global.currentTVL = global.currentTVL.minus(valueUSD)
  }
}
```

Alternatively, store `currentTVL` as a calculated field instead of incrementally updating it.

**Related Files:**
- `subgraph/src/collateral-manager.ts:145-175` (updateGlobalTVLByAsset)
- `frontend/components/dashboard/TVLOverviewCard.tsx:57-73` (workaround)
- `contracts/CollateralManager.sol` (getCollateralValueUSD calculation)

---

## 📋 Notes

- Add new issues below as they are discovered
- Mark resolved issues with ✅ and move to CHANGELOG.md
- Include clear reproduction steps when possible
- Link to relevant GitHub issues if applicable
