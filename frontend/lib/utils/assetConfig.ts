/**
 * Asset Configuration Utilities
 *
 * Fetches asset configs (LTV, liquidation threshold, decimals, prices) from on-chain contracts.
 * Replaces hardcoded values and subgraph data in simulation hooks.
 *
 * WHY: Simulation hooks were using:
 * - Hardcoded stablecoin prices ($1.00)
 * - Subgraph LTV values (may be outdated: 80% vs 66% on-chain)
 * - Subgraph liquidation thresholds
 *
 * Solution: Single source of truth from CollateralManager.getAssetConfig() + OracleAggregator.getPrice()
 */

import { useReadContract } from "wagmi";
import { CONTRACTS, TOKENS } from "@/lib/contracts/addresses";
import { POSITION_READ_ABIS } from "@/lib/utils/position";

/**
 * ABIs for asset configuration reads
 */
export const ASSET_CONFIG_ABIS = {
  // CollateralManager.getAssetConfig(address) -> CollateralConfig struct
  GET_ASSET_CONFIG: [
    {
      inputs: [{ name: "asset", type: "address" }],
      name: "getAssetConfig",
      outputs: [
        {
          components: [
            { name: "ltv", type: "uint256" },                    // Percentage (66 = 66%)
            { name: "liquidationThreshold", type: "uint256" },   // Percentage (83 = 83%)
            { name: "liquidationPenalty", type: "uint256" },     // Percentage (10 = 10%)
            { name: "decimals", type: "uint8" },
            { name: "enabled", type: "bool" },
            { name: "symbol", type: "string" },
          ],
          internalType: "struct CollateralManager.CollateralConfig",
          name: "",
          type: "tuple",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ] as const,
} as const;

/**
 * Asset configuration interface
 */
export interface AssetConfig {
  address: string;
  symbol: string;
  decimals: number;
  ltv: number;                    // Percentage (66 for 66%, 90 for 90%)
  liquidationThreshold: number;   // Percentage (83 for 83%, 95 for 95%)
  liquidationPenalty: number;     // Percentage (10 for 10%, 5 for 5%)
  priceUSD: number;               // USD price from oracle (e.g., 2500.00 for $2500)
  enabled: boolean;
}

/**
 * Hook to fetch single asset configuration from on-chain contracts
 *
 * @param assetAddress - Asset address (ETH, USDC, DAI)
 * @returns AssetConfig or null if loading/error
 */
export function useAssetConfig(assetAddress: `0x${string}` | undefined): {
  config: AssetConfig | null;
  isLoading: boolean;
  error: Error | null;
} {
  // Fetch asset config from CollateralManager
  const {
    data: configData,
    isLoading: configLoading,
    error: configError,
  } = useReadContract({
    address: CONTRACTS.COLLATERAL_MANAGER,
    abi: ASSET_CONFIG_ABIS.GET_ASSET_CONFIG,
    functionName: "getAssetConfig",
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
      refetchInterval: 30000, // 30s (config changes are rare)
    },
  });

  // Fetch asset price from OracleAggregator
  const {
    data: priceData,
    isLoading: priceLoading,
    error: priceError,
  } = useReadContract({
    address: CONTRACTS.ORACLE_AGGREGATOR,
    abi: POSITION_READ_ABIS.GET_PRICE,
    functionName: "getPrice",
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
      refetchInterval: 5000, // 5s (prices change frequently)
    },
  });

  // Parse and combine data
  if (!assetAddress || !configData || !priceData) {
    return {
      config: null,
      isLoading: configLoading || priceLoading,
      error: (configError || priceError) as Error | null,
    };
  }

  // configData is now a struct with named properties
  // NOTE: Contract stores values as percentages (66, 83, 10), not basis points
  const config: AssetConfig = {
    address: assetAddress,
    symbol: configData.symbol,
    decimals: Number(configData.decimals),
    ltv: Number(configData.ltv),                         // Percentage (66 = 66%)
    liquidationThreshold: Number(configData.liquidationThreshold),  // Percentage (83 = 83%)
    liquidationPenalty: Number(configData.liquidationPenalty),      // Percentage (10 = 10%)
    priceUSD: Number(priceData) / 1e8,                  // 8 decimals (Chainlink format)
    enabled: configData.enabled,
  };

  return {
    config,
    isLoading: false,
    error: null,
  };
}

/**
 * Hook to fetch multiple asset configurations (batch)
 *
 * @param _assetAddresses - Array of asset addresses (not used - fetches all 3 assets)
 * @returns Map of asset address (lowercase) → AssetConfig
 */
export function useAssetConfigs(_assetAddresses: readonly `0x${string}`[] | undefined): {
  configs: Record<string, AssetConfig>;
  isLoading: boolean;
  hasError: boolean;
} {
  // Fetch ETH config
  const ethConfig = useAssetConfig(TOKENS.ETH);
  // Fetch USDC config
  const usdcConfig = useAssetConfig(TOKENS.USDC);
  // Fetch DAI config
  const daiConfig = useAssetConfig(TOKENS.DAI);

  // Aggregate results
  const configs: Record<string, AssetConfig> = {};
  const isLoading = ethConfig.isLoading || usdcConfig.isLoading || daiConfig.isLoading;
  const hasError = !!ethConfig.error || !!usdcConfig.error || !!daiConfig.error;

  // Build config map (lowercase keys for matching)
  if (ethConfig.config) {
    configs[ethConfig.config.address.toLowerCase()] = ethConfig.config;
  }
  if (usdcConfig.config) {
    configs[usdcConfig.config.address.toLowerCase()] = usdcConfig.config;
  }
  if (daiConfig.config) {
    configs[daiConfig.config.address.toLowerCase()] = daiConfig.config;
  }

  return { configs, isLoading, hasError };
}

/**
 * Get asset config from configs map (helper)
 *
 * @param configs - Map from useAssetConfigs()
 * @param assetAddress - Asset address to lookup
 * @returns AssetConfig or null if not found
 */
export function getAssetConfig(
  configs: Record<string, AssetConfig>,
  assetAddress: string
): AssetConfig | null {
  return configs[assetAddress.toLowerCase()] || null;
}
