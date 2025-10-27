# Subgraph Bugs Analysis - LendForge v3.1

## Test Results Summary
- ✅ 9/10 queries successful
- ❌ 1 query failed (DailyMetrics)
- ⚠️ Multiple data integrity issues detected

---

## 🐛 Bug #1: Assets show "UNKNOWN" symbol and 0 LTV

### Evidence
```graphql
{
  "id": "0xc47095ad18c67fba7e46d56bdbb014901f3e327b",
  "symbol": "UNKNOWN",
  "decimals": 18,
  "ltv": 0,
  "liquidationThreshold": 0,
  "enabled": true
}
```

### Root Cause
The `AssetAdded` event is NOT being indexed by the subgraph. Assets are created with default values in `getOrCreateCollateralAsset()`:

```typescript
// src/collateral-manager.ts:121-137
function getOrCreateCollateralAsset(assetAddress: Bytes): CollateralAsset {
  let assetId = assetAddress.toHexString()
  let asset = CollateralAsset.load(assetId)

  if (!asset) {
    asset = new CollateralAsset(assetId)
    asset.symbol = "UNKNOWN"        // ❌ Never updated
    asset.decimals = 18              // ❌ Wrong for USDC (6 decimals)
    asset.ltv = 0                    // ❌ Should be 90/66
    asset.liquidationThreshold = 0   // ❌ Should be 95/83
    asset.enabled = true
    asset.totalDeposited = ZERO_BI
    asset.save()
  }

  return asset
}
```

The `handleAssetAdded()` handler exists (line 257-266) but is never called because:
- **Hypothesis**: `AssetAdded` events were emitted BEFORE startBlock 9486400
- OR: The events exist but subgraph never re-indexed from deployment block

### Contract Verification
On-chain data confirms assets ARE correctly configured:

```bash
# USDC (0xC47095AD18C67FBa7E46D56BDBB014901f3e327b)
ltv: 90
liquidationThreshold: 95
enabled: true

# DAI (0x2FA332E8337642891885453Fd40a7a7Bb010B71a)
ltv: 90
liquidationThreshold: 95
enabled: true

# ETH (0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)
ltv: 66
liquidationThreshold: 83
enabled: true
```

### Solution
Need to find the block number where `AssetAdded` events were emitted and update startBlock in `subgraph.yaml`:

```yaml
# CollateralManager datasource
startBlock: [DEPLOYMENT_BLOCK]  # Find block where addAsset() was called
```

---

## 🐛 Bug #2: User.totalCollateralUSD and totalBorrowed always 0

### Evidence
```graphql
{
  "id": "0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01",
  "totalCollateralUSD": "0",      // ❌ Should be $201
  "totalBorrowed": "0",            // ❌ Should reflect borrowed amount
  "collaterals": [
    {
      "valueUSD": "20000000000"    // ✅ $200 correct (per asset)
    },
    {
      "valueUSD": "20100000000"    // ✅ $201 correct
    }
  ]
}
```

### Root Cause
The `user.totalCollateralUSD` is initialized to 0 but NEVER updated in handlers:

```typescript
// src/collateral-manager.ts:154-182
export function handleCollateralDeposited(event: CollateralDeposited): void {
  let user = getOrCreateUser(event.params.user.toHexString(), event.block.timestamp)

  // ... update userCollateral.valueUSD ...

  // ❌ MISSING: user.totalCollateralUSD is never updated!
  user.lifetimeDeposits = user.lifetimeDeposits.plus(event.params.amount)
  user.updatedAt = event.block.timestamp
  user.save()
}
```

### Solution
Add aggregation logic in both deposit and withdrawal handlers:

```typescript
// After calculating userCollateral.valueUSD
user.totalCollateralUSD = calculateAssetValueUSD(
  event.address,
  event.params.user,
  event.params.asset,
  userCollateral.amount
)
user.save()
```

Same fix needed for `totalBorrowed` in lending-pool.ts handlers.

---

## 🐛 Bug #3: GlobalMetric.activePositions = -1

### Evidence
```graphql
{
  "globalMetrics": [{
    "activePositions": -1,  // ❌ Impossible value
    "totalUsers": 1,
    "totalPositions": 0
  }]
}
```

### Root Cause
Likely an underflow bug where `activePositions` is decremented below 0.

### Solution
Need to review lending-pool.ts handlers for position status changes and ensure proper increment/decrement logic.

---

## 🐛 Bug #4: totalETHDeposited/totalUSDCDeposited/totalDAIDeposited always 0

### Evidence
```graphql
{
  "totalETHDeposited": "0",
  "totalUSDCDeposited": "0",
  "totalDAIDeposited": "0"
}
```

### Root Cause
The `updateGlobalTVLByAsset()` function only handles ETH, but USDC/DAI addresses are commented out:

```typescript
// src/collateral-manager.ts:139-152
function updateGlobalTVLByAsset(asset: Bytes, amountChange: BigInt, isDeposit: boolean): void {
  let global = GlobalMetric.load("global")!

  if (asset.equals(ETH_ADDRESS)) {
    if (isDeposit) {
      global.totalETHDeposited = global.totalETHDeposited.plus(amountChange)
    } else {
      global.totalETHDeposited = global.totalETHDeposited.minus(amountChange)
    }
  }
  // ❌ Add USDC and DAI tracking when addresses are known

  global.save()
}
```

### Solution
Add USDC and DAI tracking:

```typescript
const USDC_ADDRESS = Bytes.fromHexString("0xC47095AD18C67FBa7E46D56BDBB014901f3e327b")
const DAI_ADDRESS = Bytes.fromHexString("0x2FA332E8337642891885453Fd40a7a7Bb010B71a")

function updateGlobalTVLByAsset(asset: Bytes, amountChange: BigInt, isDeposit: boolean): void {
  let global = GlobalMetric.load("global")!

  if (asset.equals(ETH_ADDRESS)) {
    // ... existing ETH logic
  } else if (asset.equals(USDC_ADDRESS)) {
    if (isDeposit) {
      global.totalUSDCDeposited = global.totalUSDCDeposited.plus(amountChange)
    } else {
      global.totalUSDCDeposited = global.totalUSDCDeposited.minus(amountChange)
    }
  } else if (asset.equals(DAI_ADDRESS)) {
    if (isDeposit) {
      global.totalDAIDeposited = global.totalDAIDeposited.plus(amountChange)
    } else {
      global.totalDAIDeposited = global.totalDAIDeposited.minus(amountChange)
    }
  }

  global.save()
}
```

---

## 🐛 Bug #5: Query #7 returns null (wrong user address)

### Evidence
```graphql
query GetUserCollaterals($userId: String!) {
  user(id: $userId) {  // ❌ Returns null
```

### Root Cause
Test script uses wrong address:

```javascript
const USER_ADDRESS = '0xf350520c3a1026ac9d03dbbe71d1db841eb9a6c5';  // ❌ Wrong
// Should be: '0xf350b91b403ced3c6e68d34c13ebdaae3bbd4e01'  ✅ Correct
```

### Solution
Update test script with correct address.

---

## 🐛 Bug #6: DailyMetric query fails (schema mismatch)

### Evidence
```
❌ 10. Daily Metrics - ERROR:
Type `DailyMetric` has no field `totalDepositsUSD`
Type `DailyMetric` has no field `totalBorrowsUSD`
Type `DailyMetric` has no field `totalRepaymentsUSD`
...
```

### Root Cause
The query in `validation_queries.graphql` doesn't match the schema definition.

### Solution
Option 1: Remove query #10 from validation (DailyMetric not implemented yet)
Option 2: Check schema.graphql for actual DailyMetric fields

---

## 📋 Priority Fix List

### High Priority (Data Correctness)
1. ✅ **Fix startBlock** to capture AssetAdded events → Get correct symbol/ltv/threshold
2. ✅ **Update User.totalCollateralUSD** in deposit/withdraw handlers
3. ✅ **Fix totalETHDeposited/USDC/DAI** tracking
4. ✅ **Fix activePositions underflow** bug

### Medium Priority (Data Quality)
5. Fix User.totalBorrowed aggregation in lending-pool.ts
6. Fix asset decimals (USDC should be 6, not 18)

### Low Priority (Testing)
7. Update test script with correct user address
8. Remove or fix DailyMetric query

---

## 🔍 Next Steps

1. **Find CollateralManager deployment block** to capture AssetAdded events
2. **Modify subgraph handlers** with fixes above
3. **Redeploy subgraph** with new startBlock
4. **Re-run validation** tests to verify fixes

## 📊 Expected Results After Fixes

```graphql
{
  "users": [{
    "totalCollateralUSD": "20100000000",  // $201
    "totalBorrowed": "100000000",         // $1 (from test)
    "collaterals": [{
      "asset": {
        "symbol": "USDC",                 // ✅ Not "UNKNOWN"
        "ltv": 90,                        // ✅ Not 0
        "liquidationThreshold": 95        // ✅ Not 0
      }
    }]
  }],
  "globalMetrics": [{
    "activePositions": 0,                 // ✅ Not -1
    "totalUSDCDeposited": "101000000",    // ✅ Not 0
    "totalDAIDeposited": "100000000000000000000"  // ✅ Not 0
  }]
}
```
