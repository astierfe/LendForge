import { gql } from '@apollo/client';

/**
 * Query to fetch global protocol metrics
 * Used on landing page and dashboard
 *
 * WORKAROUND: globalMetrics.activePositions is buggy (always returns 0)
 * Instead, we count users with activePositions > 0
 * Since each user can have max 1 active position, counting users = counting positions
 */
export const GET_GLOBAL_METRICS = gql`
  query GetGlobalMetrics {
    globalMetrics(first: 1, orderBy: updatedAt, orderDirection: desc) {
      id
      currentTVL
      currentBorrowed
      totalETHDeposited
      totalUSDCDeposited
      totalDAIDeposited
      updatedAt
    }

    # Count users with active positions (workaround for buggy globalMetrics.activePositions)
    activeUsers: users(where: { activePositions_gt: 0 }) {
      id
    }
  }
`;

/**
 * Query to fetch user position
 */
export const GET_USER_POSITION = gql`
  query GetUserPosition($userId: ID!) {
    user(id: $userId) {
      id
      totalCollateralUSD
      totalBorrowed
      healthFactor
      positions(where: { status: "ACTIVE" }) {
        id
        collateralETH
        collateralUSDC
        collateralDAI
        borrowed
        healthFactor
        status
        createdAt
        updatedAt
      }
    }
  }
`;

/**
 * Query to fetch daily metrics for charts
 */
export const GET_DAILY_METRICS = gql`
  query GetDailyMetrics($first: Int!, $skip: Int!) {
    dailyMetrics(first: $first, skip: $skip, orderBy: date, orderDirection: desc) {
      id
      date
      totalTVL
      totalBorrowed
      ethTVL
      usdcTVL
      daiTVL
      activePositions
      liquidationsCount
      volumeDeposited
      volumeBorrowed
      volumeRepaid
    }
  }
`;

/**
 * Query to fetch recent liquidations
 *
 * Note: Schema has collateralSeizedUSD (not collateralSeized) and no collateralAsset field
 */
export const GET_RECENT_LIQUIDATIONS = gql`
  query GetRecentLiquidations($first: Int!) {
    liquidations(first: $first, orderBy: timestamp, orderDirection: desc) {
      id
      user {
        id
      }
      liquidator
      debtRepaid
      collateralSeizedUSD
      timestamp
      txHash
      healthFactorBefore
      blockNumber
    }
  }
`;

/**
 * Query to fetch recent transactions
 */
export const GET_RECENT_TRANSACTIONS = gql`
  query GetRecentTransactions($first: Int!, $types: [TransactionType!]) {
    transactions(
      first: $first
      orderBy: timestamp
      orderDirection: desc
      where: { type_in: $types }
    ) {
      id
      type
      asset
      amount
      timestamp
      txHash
      user {
        id
      }
    }
  }
`;

/**
 * Query to fetch detailed user position with collateral breakdown
 * Schema v3.0: Aligned with User, Position, and UserCollateral entities
 *
 * Usage: Dashboard Phase 3 - UserPositionCard component
 *
 * Returns:
 * - User totals (totalCollateralUSD, totalBorrowed, activePositions)
 * - Active positions with health factor
 * - Collateral breakdown by asset (ETH/USDC/DAI) with amounts and USD values
 * - Asset config (LTV, liquidation threshold)
 */
export const GET_USER_POSITION_DETAILED = gql`
  query GetUserPositionDetailed($userId: ID!) {
    user(id: $userId) {
      id
      totalCollateralUSD
      totalBorrowed
      activePositions
      lifetimeDeposits
      lifetimeBorrows
      lifetimeRepayments
      liquidationCount
      createdAt
      updatedAt

      # Active positions with health factor
      positions(where: { status: ACTIVE }) {
        id
        totalCollateralUSD
        borrowed
        healthFactor
        status
        createdAt
        updatedAt
      }

      # Collateral breakdown by asset (ETH/USDC/DAI)
      collaterals {
        id
        amount
        valueUSD
        updatedAt
        asset {
          id
          symbol
          decimals
          ltv
          liquidationThreshold
          enabled
        }
      }
    }
  }
`;

/**
 * Query to fetch all user positions (active, repaid, liquidated)
 * Used for /positions page to show historical positions
 *
 * Returns:
 * - All positions regardless of status
 * - Basic position data (collateral, borrowed, health factor)
 * - Status, timestamps, and transaction count
 * - Ordered by most recent first
 */
export const GET_USER_POSITIONS_ALL = gql`
  query GetUserPositionsAll($userId: ID!, $first: Int!, $skip: Int!) {
    user(id: $userId) {
      id
      positions(
        first: $first
        skip: $skip
        orderBy: updatedAt
        orderDirection: desc
      ) {
        id
        totalCollateralUSD
        borrowed
        healthFactor
        status
        createdAt
        updatedAt
        closedAt
        transactions {
          id
          type
          amount
          timestamp
        }
      }
    }
  }
`;
