# Next Session - Frontend Phase 4: Deposit Flow

Hi Claude,

Working on **LendForge v5.3.0** - DeFi lending protocol on Sepolia.

## Current Status
- Phase 1-3 complete: Dashboard with 4 cards (TVL, Position, Health Factor, Quick Actions)
- Hooks working: `useUserPosition`, `useHealthFactor` (with `calculateMaxBorrowable`)
- **Phase 4 (0/3):** ⏳ AssetSelector | ⏳ AmountInput | ⏳ DepositForm

## Goal: Build `/deposit` Page

Create deposit flow with asset selection (ETH/USDC/DAI), amount input, ERC20 approval, and transaction handling.

## Components to Create

### 1. AssetSelector (`components/forms/AssetSelector.tsx`)
```typescript
interface Props {
  selectedAsset: "ETH" | "USDC" | "DAI";
  onAssetChange: (asset: "ETH" | "USDC" | "DAI") => void;
}
```
- Tab UI for 3 assets
- Show balance & price for selected asset

### 2. AmountInput (`components/forms/AmountInput.tsx`)
```typescript
interface Props {
  asset: "ETH" | "USDC" | "DAI";
  amount: string;
  balance: string;
  onAmountChange: (amount: string) => void;
  error?: string;
}
```
- Input + MAX button
- Show USD value
- Validate: insufficient balance, amount > 0

### 3. DepositForm (`components/forms/DepositForm.tsx`)
**Flow:**
1. Select asset (ETH/USDC/DAI)
2. Enter amount
3. **For ERC20:** Check allowance → Approve if needed → Enable deposit
4. **For ETH:** Skip approval
5. Call `lendingPool.depositCollateral(asset, amount)`
6. Show preview: new collateral, max borrowable, health factor
7. On success: toast + redirect to `/dashboard`

**State:**
```typescript
const [selectedAsset, setSelectedAsset] = useState<"ETH" | "USDC" | "DAI">("ETH");
const [amount, setAmount] = useState("");
```

**Wagmi Hooks:**
- `useAccount()` - User address
- `useBalance()` - ETH balance
- `useReadContract()` - Check ERC20 allowance
- `useWriteContract()` - Approve & deposit
- `useWaitForTransactionReceipt()` - Wait tx confirmation

## Key Implementation Details

**ERC20 Approval:**
```typescript
// Check allowance
const allowance = useReadContract({
  address: USDC_ADDRESS,
  abi: ERC20_ABI,
  functionName: 'allowance',
  args: [userAddress, LENDING_POOL_ADDRESS]
});

// If allowance < amount: show Approve button
// Call: erc20.approve(LENDING_POOL_ADDRESS, MAX_UINT256)
```

**Deposit:**
```typescript
// ETH: { value: parseEther(amount) }
// ERC20: { value: 0n }, pass amount as arg
lendingPool.depositCollateral(assetAddress, parseUnits(amount, decimals))
```

**Position Preview:**
```typescript
const newCollateralUSD = currentCollateralUSD + (amount × price);
const newMaxBorrowable = newCollateralUSD × (LTV / 100);
const newAvailable = newMaxBorrowable - currentBorrowedUSD;
```

**Decimals:** ETH/DAI = 18, USDC = 6

## Files to Reference
- Contract addresses: `lib/contracts/addresses.ts`
- LTV config: `lib/contracts/config.ts` (LTV_RATIOS)
- Hooks: `hooks/useUserPosition.ts`, `hooks/useHealthFactor.ts`
- ABIs: `lib/contracts/abis/LendingPool.json` (already exists)
- Need to create: `lib/contracts/abis/ERC20.json` (minimal: approve, allowance, balanceOf)

## Start Here
1. Create minimal ERC20 ABI
2. Create AssetSelector (simplest)
3. Create AmountInput
4. Create DepositForm (orchestrates all)
5. Create `/deposit` page
6. Test: ETH (no approval) & USDC (with approval)

Keep it simple - only read files when needed for implementation.
