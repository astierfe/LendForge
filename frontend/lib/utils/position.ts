/**
 * Position Calculation Utilities
 *
 * Centralized on-chain data fetching and calculations for:
 * - Total borrowed amount (ETH)
 * - Total collateral value (USD)
 * - LTV (Loan-to-Value ratio)
 * - Health Factor components
 *
 * WHY: Prevents inconsistencies from multiple calculation points using different data sources
 * (subgraph vs on-chain). All critical position metrics calculated here with on-chain data.
 */

/**
 * Contract ABIs for on-chain reads
 */
export const POSITION_READ_ABIS = {
  // LendingPool.getBorrowedAmount(address) -> uint256
  GET_BORROWED_AMOUNT: [
    {
      inputs: [{ name: "user", type: "address" }],
      name: "getBorrowedAmount",
      outputs: [{ name: "", type: "uint256" }],
      stateMutability: "view",
      type: "function",
    },
  ] as const,

  // CollateralManager.getUserCollaterals(address) -> (address[], uint256[], uint256[])
  GET_USER_COLLATERALS: [
    {
      inputs: [{ name: "user", type: "address" }],
      name: "getUserCollaterals",
      outputs: [
        { name: "assets", type: "address[]" },
        { name: "amounts", type: "uint256[]" },
        { name: "valuesUSD", type: "uint256[]" }, // 8 decimals
      ],
      stateMutability: "view",
      type: "function",
    },
  ] as const,

  // OracleAggregator.getPrice(address) -> uint256
  GET_PRICE: [
    {
      inputs: [{ name: "asset", type: "address" }],
      name: "getPrice",
      outputs: [{ name: "", type: "uint256" }], // 8 decimals
      stateMutability: "view",
      type: "function",
    },
  ] as const,
} as const;

/**
 * Parse borrowed amount from Wei to ETH
 *
 * @param borrowedWei - Raw Wei value from getBorrowedAmount()
 * @returns Borrowed amount in ETH (18 decimals)
 */
export function parseBorrowedAmount(borrowedWei: bigint | undefined | null): number {
  if (borrowedWei === undefined || borrowedWei === null) return 0;
  return Number(borrowedWei) / 1e18; // 18 decimals
}

/**
 * Parse total collateral USD from getUserCollaterals() data
 *
 * WORKAROUND ANO_003: valuesUSD returns [0n, 0n, 0n] because contract lacks getAssetValueUSD()
 * Solution: Calculate manually from amounts × prices (same as TVLOverviewCard)
 *
 * @param collateralData - Full response from getUserCollaterals() [assets, amounts, valuesUSD]
 * @param ethPriceUSD - ETH price from oracle (USD, 8 decimals already parsed)
 * @returns Total collateral in USD
 */
export function parseCollateralUSD(
  collateralData: readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[]] | undefined | null,
  ethPriceUSD: number
): number {
  if (!collateralData) {
    console.warn('[parseCollateralUSD] No collateral data');
    return 0;
  }

  const [assets, amounts] = collateralData;

  if (!assets || !amounts || assets.length === 0) {
    return 0;
  }

  // WORKAROUND ANO_003: Calculate valueUSD = amount × price manually
  // Asset config by address (lowercase for matching)
  // Addresses from console log:
  // - USDC: 0xC47095AD18C67FBa7E46D56BDBB014901f3e327b
  // - DAI: 0x2FA332E8337642891885453Fd40a7a7Bb010B71a
  // - ETH: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
  const assetConfig: Record<string, { decimals: number; price: number }> = {
    '0xc47095ad18c67fba7e46d56bdbb014901f3e327b': { decimals: 6, price: 1.0 },  // USDC
    '0x2fa332e8337642891885453fd40a7a7bb010b71a': { decimals: 18, price: 1.0 }, // DAI
    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': { decimals: 18, price: ethPriceUSD }, // ETH
  };

  let totalUSD = 0;

  for (let i = 0; i < assets.length; i++) {
    const assetAddress = assets[i].toLowerCase();
    const amount = amounts[i];

    const config = assetConfig[assetAddress];
    if (!config) {
      console.warn(`[parseCollateralUSD] Unknown asset: ${assetAddress}, using defaults`);
      continue;
    }

    // Parse amount with correct decimals
    const parsedAmount = Number(amount) / Math.pow(10, config.decimals);
    const valueUSD = parsedAmount * config.price;

    console.log(`[parseCollateralUSD] Asset ${i}:`, assetAddress, '→', parsedAmount, '×', config.price, '=', valueUSD, 'USD');

    totalUSD += valueUSD;
  }

  console.log('[parseCollateralUSD] Total collateral USD:', totalUSD);
  return totalUSD;
}

/**
 * Parse ETH price from oracle (8 decimals)
 *
 * @param priceWei - Raw uint256 from getPrice()
 * @returns ETH price in USD
 */
export function parseETHPrice(priceWei: bigint | undefined | null): number {
  if (priceWei === undefined || priceWei === null) return 1600; // Fallback
  return Number(priceWei) / 1e8; // 8 decimals (Chainlink)
}

/**
 * Calculate LTV (Loan-to-Value) ratio
 *
 * Formula: LTV = (Total Borrowed USD / Total Collateral USD) × 100
 *
 * @param borrowedETH - Total borrowed in ETH
 * @param ethPriceUSD - ETH price in USD
 * @param collateralUSD - Total collateral in USD
 * @returns LTV percentage (0-100+)
 */
export function calculateLTV(
  borrowedETH: number,
  ethPriceUSD: number,
  collateralUSD: number
): number {
  if (collateralUSD <= 0) return 0;

  const borrowedUSD = borrowedETH * ethPriceUSD;
  const ltv = (borrowedUSD / collateralUSD) * 100;

  return ltv;
}

/**
 * Calculate weighted LTV from on-chain collateral data
 *
 * Formula: Σ(collateral_value_USD × asset_LTV) for all assets
 *
 * @param collateralData - From getUserCollaterals() [assets, amounts, valuesUSD]
 * @param assetConfigs - Map of asset address (lowercase) → AssetConfig (from useAssetConfigs)
 * @returns Total weighted LTV in USD (max borrowable amount)
 */
export function calculateWeightedLTV(
  collateralData: readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[]] | undefined | null,
  assetConfigs: Record<string, { decimals: number; priceUSD: number; ltv: number }>
): number {
  if (!collateralData) return 0;

  const [assets, amounts] = collateralData;

  if (!assets || !amounts || assets.length === 0) return 0;

  let totalWeightedLTV = 0;

  console.log('[calculateWeightedLTV] assetConfigs:', assetConfigs);
  for (let i = 0; i < assets.length; i++) {
    const assetAddress = assets[i].toLowerCase();
    const config = assetConfigs[assetAddress];

    if (!config) {
      console.warn(`[calculateWeightedLTV] Unknown asset: ${assetAddress}`);
      console.warn(`[calculateWeightedLTV] Available configs:`, Object.keys(assetConfigs));
      continue;
    }

    // Parse amount with correct decimals
    const amount = Number(amounts[i]) / Math.pow(10, config.decimals);
    const valueUSD = amount * config.priceUSD;
    const ltvDecimal = config.ltv / 100; // Convert percentage to decimal (66 → 0.66)

    console.log(`[calculateWeightedLTV] Asset ${i}:`, {
      address: assetAddress,
      amount,
      priceUSD: config.priceUSD,
      valueUSD,
      ltvPercent: config.ltv,
      ltvDecimal,
      contribution: valueUSD * ltvDecimal
    });

    totalWeightedLTV += valueUSD * ltvDecimal;
  }

  console.log('[calculateWeightedLTV] TOTAL:', totalWeightedLTV);
  return totalWeightedLTV;
}

/**
 * Calculate weighted liquidation threshold from on-chain collateral data
 *
 * Formula: Σ(collateral_value_USD × asset_liquidation_threshold) for all assets
 *
 * @param collateralData - From getUserCollaterals() [assets, amounts, valuesUSD]
 * @param assetConfigs - Map of asset address (lowercase) → AssetConfig (from useAssetConfigs)
 * @returns Total weighted liquidation threshold in USD
 */
export function calculateWeightedLiquidationThreshold(
  collateralData: readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[]] | undefined | null,
  assetConfigs: Record<string, { decimals: number; priceUSD: number; liquidationThreshold: number }>
): number {
  if (!collateralData) return 0;

  const [assets, amounts] = collateralData;

  if (!assets || !amounts || assets.length === 0) return 0;

  let totalWeightedThreshold = 0;

  console.log('[calculateWeightedLiquidationThreshold] assetConfigs:', assetConfigs);
  for (let i = 0; i < assets.length; i++) {
    const assetAddress = assets[i].toLowerCase();
    const config = assetConfigs[assetAddress];

    if (!config) {
      console.warn(`[calculateWeightedLiquidationThreshold] Unknown asset: ${assetAddress}`);
      console.warn(`[calculateWeightedLiquidationThreshold] Available configs:`, Object.keys(assetConfigs));
      continue;
    }

    // Parse amount with correct decimals
    const amount = Number(amounts[i]) / Math.pow(10, config.decimals);
    const valueUSD = amount * config.priceUSD;
    const thresholdDecimal = config.liquidationThreshold / 100; // Convert percentage to decimal (83 → 0.83)

    console.log(`[calculateWeightedLiquidationThreshold] Asset ${i}:`, {
      address: assetAddress,
      amount,
      priceUSD: config.priceUSD,
      valueUSD,
      thresholdPercent: config.liquidationThreshold,
      thresholdDecimal,
      contribution: valueUSD * thresholdDecimal
    });

    totalWeightedThreshold += valueUSD * thresholdDecimal;
  }

  console.log('[calculateWeightedLiquidationThreshold] TOTAL:', totalWeightedThreshold);
  return totalWeightedThreshold;
}

/**
 * Position data structure (on-chain sources only)
 */
export interface OnChainPosition {
  borrowedETH: number;
  borrowedUSD: number;
  collateralUSD: number;
  ethPriceUSD: number;
  ltvPercent: number;
  hasActiveBorrow: boolean;
}

/**
 * Calculate complete position from on-chain data
 *
 * @param borrowedWei - From LendingPool.getBorrowedAmount()
 * @param collateralData - From CollateralManager.getUserCollaterals() [assets, amounts, valuesUSD]
 * @param ethPriceWei - From OracleAggregator.getPrice(ETH)
 * @returns Complete position data
 */
export function calculatePosition(
  borrowedWei: bigint | undefined | null,
  collateralData: readonly [readonly `0x${string}`[], readonly bigint[], readonly bigint[]] | undefined | null,
  ethPriceWei: bigint | undefined | null
): OnChainPosition {
  const ethPriceUSD = parseETHPrice(ethPriceWei);
  const borrowedETH = parseBorrowedAmount(borrowedWei);
  const collateralUSD = parseCollateralUSD(collateralData, ethPriceUSD);

  const borrowedUSD = borrowedETH * ethPriceUSD;
  const ltvPercent = calculateLTV(borrowedETH, ethPriceUSD, collateralUSD);
  const hasActiveBorrow = borrowedETH > 0;

  return {
    borrowedETH,
    borrowedUSD,
    collateralUSD,
    ethPriceUSD,
    ltvPercent,
    hasActiveBorrow,
  };
}
