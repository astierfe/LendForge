/**
 * TVL Calculation Utilities
 *
 * Workaround for ANO_004: GlobalMetric.currentTVL incorrectly adds mixed decimals
 * These utilities calculate TVL from individual asset totals with correct decimal handling
 */

/**
 * Calculate TVL from GlobalMetric asset totals (for landing page / global stats)
 *
 * @param totalETHDeposited - Raw Wei amount (18 decimals)
 * @param totalUSDCDeposited - Raw amount (6 decimals)
 * @param totalDAIDeposited - Raw Wei amount (18 decimals)
 * @param ethPrice - ETH price in USD
 * @param usdcPrice - USDC price in USD (default 1.0)
 * @param daiPrice - DAI price in USD (default 1.0)
 * @returns Total TVL in USD
 */
export function calculateGlobalTVL(
  totalETHDeposited: string,
  totalUSDCDeposited: string,
  totalDAIDeposited: string,
  ethPrice: number,
  usdcPrice: number = 1.0,
  daiPrice: number = 1.0
): number {
  // Parse each asset with correct decimals
  const ethDeposited = parseFloat(totalETHDeposited) / 1e18;  // 18 decimals
  const usdcDeposited = parseFloat(totalUSDCDeposited) / 1e6; // 6 decimals (CRITICAL!)
  const daiDeposited = parseFloat(totalDAIDeposited) / 1e18;  // 18 decimals

  // Convert to USD using oracle prices
  const ethValueUSD = ethDeposited * ethPrice;
  const usdcValueUSD = usdcDeposited * usdcPrice; // Use oracle price (ANO_009 fix)
  const daiValueUSD = daiDeposited * daiPrice;     // Use oracle price (ANO_009 fix)

  // Calculate total
  return ethValueUSD + usdcValueUSD + daiValueUSD;
}

/**
 * Asset configuration with decimals and price mapping
 */
export interface AssetConfig {
  symbol: string;
  decimals: number;
  price: number;
}

/**
 * Calculate TVL from on-chain collateral array (for user positions)
 *
 * @param collaterals - Array of { address, amount } from contract
 * @param assetMap - Mapping of address -> asset config with price
 * @returns Total value in USD
 */
export function calculateCollateralTVL(
  collaterals: Array<{ address: string; amount: bigint }>,
  assetMap: Record<string, AssetConfig>
): number {
  return collaterals.reduce((sum, col) => {
    const asset = assetMap[col.address.toLowerCase()];
    if (!asset) {
      console.warn('[calculateCollateralTVL] Unknown asset:', col.address);
      return sum;
    }

    const amount = Number(col.amount) / Math.pow(10, asset.decimals);
    const valueUSD = amount * asset.price;

    return sum + valueUSD;
  }, 0);
}
