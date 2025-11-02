# Next Session - Frontend Phase 3 Dashboard

Hi Claude,

Working on **LendForge v5.2.0** - DeFi lending protocol with multi-collateral support on Sepolia.

## Current Status
- Smart contracts deployed and tested (LendingPool v4.1 fixed borrow validation bug)
- Subgraph v4.1.1 deployed with correct activePositions tracking
- Frontend Phase 1 & 2 complete (Next.js 15 + Apollo + RainbowKit)
- Hooks created: `useUserPosition.ts`, `useHealthFactor.ts` in `frontend/hooks/`
- GraphQL query ready: `GET_USER_POSITION_DETAILED` in `frontend/lib/graphql/queries/metrics.ts`
- Test position exists on-chain with HF = 15.12, activePositions = 1

## Goal
Implement Phase 3 Dashboard with real data from subgraph.

## What I Need

Create 4 dashboard cards in `app/(authenticated)/dashboard/page.tsx`:

1. **TVLOverviewCard** - Global TVL with ETH/USDC/DAI breakdown
2. **UserPositionCard** - User collateral, debt, available to borrow
3. **HealthFactorDisplay** - Visual gauge with risk levels (Safe/Warning/Danger)
4. **QuickActionsCard** - CTA buttons (Deposit/Borrow/Repay)

## Key Files
- `frontend/FRONTEND_STATUS.md` - Phase 3 specs (line 224+)
- `frontend/hooks/useUserPosition.ts` - Already exists, test if working
- `frontend/hooks/useHealthFactor.ts` - Already exists, test if working
- `frontend/lib/contracts/config.ts` - LTV and thresholds constants

## Start Simple
Read `frontend/FRONTEND_STATUS.md` Phase 3 section, then propose implementation order. Keep context light initially.
