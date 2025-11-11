/**
 * Protocol configuration constants
 * LTV ratios, liquidation thresholds, etc.
 */

// LTV (Loan-to-Value) ratios - maximum borrowable percentage
export const LTV_RATIOS = {
  ETH: 0.66, // 66%
  USDC: 0.90, // 90% (corrected from 75%)
  DAI: 0.90, // 90% (corrected from 75%)
} as const;

// Liquidation thresholds (per-asset, read from CollateralManager)
export const LIQUIDATION_THRESHOLDS = {
  ETH: 0.83, // 83%
  USDC: 0.95, // 95%
  DAI: 0.95, // 95%
} as const;

/**
 * IMPORTANT: The LendingPool contract uses a GLOBAL liquidation threshold
 * instead of weighted thresholds. This matches DataTypes.LIQUIDATION_THRESHOLD.
 *
 * Contract: contracts/libraries/DataTypes.sol line 7
 * uint256 constant LIQUIDATION_THRESHOLD = 83;
 *
 * Used in: contracts/libraries/HealthCalculator.sol line 24
 * adjustedCollateral = (collateralValueUSD * LIQUIDATION_THRESHOLD) / 100
 *
 * All simulations must use this value to match on-chain calculations.
 */
export const GLOBAL_LIQUIDATION_THRESHOLD = 0.83; // 83% - matches contract

// Health factor levels
export const HEALTH_FACTOR = {
  SAFE: 2.0,
  WARNING: 1.5,
  DANGER: 1.2,
  LIQUIDATION: 1.0,
} as const;

// Liquidation bonus (incentive for liquidators)
export const LIQUIDATION_BONUS = 0.05; // 5%

// Oracle deviation threshold for emergency mode
export const ORACLE_DEVIATION_THRESHOLD = 0.1; // 10%
