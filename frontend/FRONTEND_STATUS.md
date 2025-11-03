# LendForge Frontend - Status

**Date:** January 31, 2025
**Version:** v5.3.0
**Status:** Phase 1-3 Completed ✅ | Phase 4 Ready 🚀

---

## Summary

Frontend **Phases 1-3** completed successfully. LendForge now has a fully functional dashboard displaying user positions, collateral, borrowing data, and health factor with visual gauges. Next phase focuses on implementing the deposit flow with ERC20 approval handling.

---

## ✅ Phase 1: Infrastructure (Completed)

### 1.1 - Next.js Project
- ✅ Next.js 15 with App Router
- ✅ React 19
- ✅ TypeScript 5.x configured
- ✅ TailwindCSS installed and configured
- ✅ ESLint setup

### 1.2 - Web3 Integration
- ✅ RainbowKit v2 installed
- ✅ wagmi v2 + viem installed
- ✅ Sepolia testnet configured (`lib/wagmi.ts`)
- ✅ Providers setup (`app/providers.tsx`)

### 1.3 - GraphQL (The Graph)
- ✅ Apollo Client with `@apollo/experimental-nextjs-app-support`
- ✅ Client configured (`lib/graphql/apollo-client.ts`)
- ✅ GraphQL queries created and working (`lib/graphql/queries/metrics.ts`)
- ✅ Query `GET_GLOBAL_METRICS` displays real data on landing page

### 1.4 - ABIs & Addresses
- ✅ ABIs copied from `../out/`:
  - CollateralManager.json
  - LendingPool.json
  - OracleAggregator.json
  - ERC20.json
- ✅ Addresses config created (`lib/contracts/addresses.ts`)
- ✅ Protocol config created (`lib/contracts/config.ts`)

### 1.5 - shadcn/ui
- ✅ shadcn CLI installed
- ✅ Base components added:
  - Button, Card, Input, Badge, Alert
  - Toast, Skeleton, Tabs

---

## ✅ Phase 2: Connection & Layout (Completed)

### 2.1 - Landing Page
- ✅ Home page created (`app/page.tsx`)
- ✅ Hero section with title and description
- ✅ ConnectButton (RainbowKit wrapper)
- ✅ Features Grid (3 cards: Multi-Asset, Secure Oracles, Transparent Metrics)
- ✅ Stats Banner with **real data** from subgraph (TVL, Active Positions, Total Borrowed)
- ✅ Auto-redirect to `/dashboard` if wallet connected
- ✅ BigInt conversion (Wei → ETH) for display

### 2.2 - Authenticated Layout
- ✅ Route group `(authenticated)/` created
- ✅ Layout with Sidebar + Header (`app/(authenticated)/layout.tsx`)
- ✅ Route protection (redirect if not connected)
- ✅ Layout components:
  - `Sidebar.tsx` - Desktop navigation
  - `Header.tsx` - Header with NetworkBadge + ConnectButton
  - `MobileNav.tsx` - Responsive mobile menu

### 2.3 - Navigation Routing
- ✅ Placeholder pages created:
  - `/dashboard` - Main dashboard
  - `/deposit` - Deposit collateral
  - `/borrow` - Borrow ETH
  - `/positions` - My positions
  - `/analytics` - Analytics
- ✅ Navigation links in Sidebar
- ✅ Active page highlight

---

## ✅ Phase 3: Dashboard Components (Completed v5.3.0)

### 3.1 - Data Hooks
**`hooks/useUserPosition.ts`**
- ✅ Fetches user position from subgraph
- ✅ Returns: collateral, borrowed, activePositions, collaterals array
- ✅ Includes formatters: `weiToEth`, `usdToNumber`, `tokenToNumber`
- ✅ Helper flags: `hasPosition`, `hasDeposits`, `hasActiveBorrow`

**`hooks/useHealthFactor.ts`**
- ✅ Calculates health factor from user position
- ✅ Returns: value, level (safe/warning/danger/liquidation), percentage, color, label, canBorrow
- ✅ Formula: `(collateralUSD × liquidationThreshold) / borrowed`
- ✅ Helper: `calculateMaxBorrowable()` with weighted LTV calculation
- ✅ **Bug Fixed**: Now returns max borrowable (not available), uses proper weighted average

### 3.2 - Dashboard Cards

**`components/dashboard/TVLOverviewCard.tsx`**
- ✅ Displays user's total collateral in USD
- ✅ Asset breakdown by ETH, USDC, DAI with percentages
- ✅ Progress bar visualization
- ✅ Empty state for users without deposits

**`components/dashboard/UserPositionCard.tsx`**
- ✅ Shows total borrowed (ETH + USD)
- ✅ Displays available to borrow (calculated from max borrowable)
- ✅ Shows current LTV used (%)
- ✅ Warning alert when LTV >= 80%
- ✅ Links to borrow and repay pages
- ✅ Empty state with "Start Borrowing" CTA

**`components/dashboard/HealthFactorDisplay.tsx`**
- ✅ Semi-circular gauge visual (speedometer style)
- ✅ Color-coded risk levels (green/yellow/orange/red)
- ✅ Needle indicator pointing to current HF
- ✅ Threshold markers: 1.0, 1.2, 1.5, 2.0, 3.0
- ✅ Contextual risk explanations (Safe/Warning/Danger/Liquidation)
- ✅ Thresholds reference card
- ✅ Empty state for users without borrows

**`components/dashboard/QuickActionsCard.tsx`**
- ✅ Three CTA buttons: Deposit, Borrow, Repay
- ✅ Contextual enable/disable logic:
  - Deposit: Always enabled
  - Borrow: Enabled if hasDeposits AND canBorrow (HF >= 1.5)
  - Repay: Enabled if hasActiveBorrow
- ✅ Navigation to respective pages

### 3.3 - Dashboard Layout
- ✅ Responsive 2-column grid (`lg:grid-cols-2`)
- ✅ Mobile: 1 card per row (stacked)
- ✅ Desktop: 2 cards per row
- ✅ Card order: TVL → Position → Health Factor → Quick Actions

### 3.4 - Test Pages (for development)
- ✅ `/test-hooks` - Test all hooks
- ✅ `/test-quick-actions` - Test QuickActionsCard states
- ✅ `/test-user-position-card` - Test UserPositionCard calculations
- ✅ `/test-health-factor` - Test HealthFactorDisplay gauge

---

## 🚀 Phase 4: Deposit Flow (Next - Estimated 2 days)

### Objective
Implement deposit page with asset selection, amount input, ERC20 approval flow, and transaction handling.

### Components to Create

**1. `components/forms/AssetSelector.tsx`**
- Tab-based UI for ETH, USDC, DAI selection
- Display balance and price for selected asset
- Emit `onAssetChange` callback

**2. `components/forms/AmountInput.tsx`**
- Input field with number validation
- MAX button to fill with user balance
- USD value preview
- Error states (insufficient balance, invalid amount)

**3. `components/forms/DepositForm.tsx`**
- Main form component orchestrating deposit flow
- ERC20 approval flow:
  - Check allowance
  - Approve if needed (max uint256)
  - Enable deposit button after approval
- ETH deposits (no approval needed)
- Position preview (new collateral, max borrowable, health factor)
- Transaction handling (loading, success, error)

**4. `app/(authenticated)/deposit/page.tsx`**
- Deposit page layout
- Imports and renders DepositForm
- Success/error toasts

### Technical Requirements
- Create minimal ERC20 ABI (approve, allowance, balanceOf)
- Use wagmi hooks: `useWriteContract`, `useWaitForTransactionReceipt`, `useReadContract`
- Handle ETH vs ERC20 differences (value parameter)
- Parse decimals correctly (ETH/DAI: 18, USDC: 6)
- Calculate position preview using existing hooks

### Key Formulas
```typescript
// New collateral value
newCollateralUSD = currentCollateralUSD + (depositAmount × assetPrice)

// Max borrowable with new collateral
newMaxBorrowableUSD = newCollateralUSD × (LTV / 100)

// Available to borrow
newAvailableToBorrow = newMaxBorrowableUSD - currentBorrowedUSD

// New health factor (if has debt)
newHF = (newCollateralUSD × liquidationThreshold) / currentBorrowed
```

---

## Files Created

```
frontend/
├── app/
│   ├── layout.tsx (✅ modified - Providers + Toaster)
│   ├── page.tsx (✅ Landing page complete)
│   ├── providers.tsx (✅ RainbowKit + wagmi)
│   │
│   └── (authenticated)/
│       ├── layout.tsx (✅ Layout with Sidebar)
│       ├── dashboard/page.tsx (✅ Phase 3 complete)
│       ├── deposit/page.tsx (⏳ Phase 4)
│       ├── borrow/page.tsx (placeholder)
│       ├── positions/page.tsx (placeholder)
│       ├── analytics/page.tsx (placeholder)
│       ├── test-hooks/page.tsx (✅)
│       ├── test-quick-actions/page.tsx (✅)
│       ├── test-user-position-card/page.tsx (✅)
│       └── test-health-factor/page.tsx (✅)
│
├── components/
│   ├── wallet/
│   │   ├── ConnectButton.tsx (✅)
│   │   ├── NetworkBadge.tsx (✅)
│   │   └── WalletInfo.tsx (✅)
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx (✅)
│   │   ├── Header.tsx (✅)
│   │   ├── PageContainer.tsx (✅)
│   │   └── MobileNav.tsx (✅)
│   │
│   ├── dashboard/ (✅ Phase 3)
│   │   ├── TVLOverviewCard.tsx
│   │   ├── UserPositionCard.tsx
│   │   ├── HealthFactorDisplay.tsx
│   │   └── QuickActionsCard.tsx
│   │
│   └── forms/ (⏳ Phase 4)
│       ├── AssetSelector.tsx
│       ├── AmountInput.tsx
│       └── DepositForm.tsx
│
├── hooks/
│   ├── useUserPosition.ts (✅)
│   └── useHealthFactor.ts (✅ with bug fix)
│
├── lib/
│   ├── contracts/
│   │   ├── abis/ (✅ 4 ABIs)
│   │   ├── addresses.ts (✅)
│   │   └── config.ts (✅)
│   │
│   ├── graphql/
│   │   ├── client.ts (✅)
│   │   └── queries/
│   │       └── metrics.ts (✅ 6 queries)
│   │
│   ├── wagmi.ts (✅)
│   └── utils.ts (✅)
│
└── .env.local (✅)
```

---

## Known Issues & Solutions

### 1. Apollo Client with Next.js 15
**Solution:** Install `@apollo/experimental-nextjs-app-support`
- Import from `@apollo/experimental-nextjs-app-support`
- Use `useSuspenseQuery` for server components

### 2. GraphQL Schema Mismatch
**Solution:** Align queries with actual subgraph schema
- `totalCollateralUSD` → `currentTVL` (BigInt)
- `totalBorrowed` → `currentBorrowed` (BigInt)
- Convert BigInt: `parseFloat(value) / 1e18`

### 3. calculateMaxBorrowable Bug (Fixed v5.3.0)
**Issue:** Returned available amount instead of max borrowable, used simple average LTV
**Solution:**
- Return `maxBorrowableUSD` instead of `availableUSD`
- Implement weighted LTV calculation based on collateral USD values

### 4. Subgraph valueUSD Bug
**Known Issue:** Collateral `valueUSD` shows total instead of per-asset
**Workaround:** Calculate manually: `amount × price`

---

## Environment Variables

```env
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/122308/lendforge-v-5/version/latest
NEXT_PUBLIC_COLLATERAL_MANAGER_ADDRESS=0x53Ea723AA0C4cd5eF459eE9351D3f9875D821758
NEXT_PUBLIC_LENDING_POOL_ADDRESS=0x06AF08708B45968492078A1900124DaA832082cD
NEXT_PUBLIC_ORACLE_AGGREGATOR_ADDRESS=0x62f41B1EDc66bC46e05c34AC40B447E5A7ab3EAe
NEXT_PUBLIC_ETH_ADDRESS=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
NEXT_PUBLIC_USDC_ADDRESS=0xC47095AD18C67FBa7E46D56BDBB014901f3e327b
NEXT_PUBLIC_DAI_ADDRESS=0x2FA332E8337642891885453Fd40a7a7Bb010B71a
```

---

## Roadmap

- ✅ **Phase 1**: Infrastructure (Next.js + Web3 + GraphQL)
- ✅ **Phase 2**: Connection & Layout (Landing + Authenticated Layout)
- ✅ **Phase 3**: Dashboard (4 cards: TVL, Position, Health Factor, Quick Actions)
- 🚀 **Phase 4**: Deposit Flow (AssetSelector + AmountInput + DepositForm)
- ⏳ **Phase 5**: Borrow Flow (BorrowForm + Health Factor Preview)
- ⏳ **Phase 6**: Analytics (TVL Chart + Liquidations Table)
- ⏳ **Phase 7**: Polish (Loading states + Error handling + Toasts)

---

**Status:** ✅ Phase 1-3 Complete | 🚀 Phase 4 Ready to Start
