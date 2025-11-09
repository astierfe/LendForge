/**
 * Contract addresses for LendForge Protocol on Sepolia Testnet
 * Source: .env.local
 */

export const SEPOLIA_CHAIN_ID = 11155111;

export const CONTRACTS = {
  COLLATERAL_MANAGER: process.env.NEXT_PUBLIC_COLLATERAL_MANAGER_ADDRESS as `0x${string}`,
  LENDING_POOL: process.env.NEXT_PUBLIC_LENDING_POOL_ADDRESS as `0x${string}`,
  ORACLE_AGGREGATOR: process.env.NEXT_PUBLIC_ORACLE_AGGREGATOR_ADDRESS as `0x${string}`,
} as const;

export const TOKENS = {
  ETH: process.env.NEXT_PUBLIC_ETH_ADDRESS as `0x${string}`,
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`,
  DAI: process.env.NEXT_PUBLIC_DAI_ADDRESS as `0x${string}`,
} as const;

// Asset metadata
export const ASSET_METADATA = {
  [TOKENS.ETH]: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  [TOKENS.USDC]: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
  [TOKENS.DAI]: {
    name: "Dai Stablecoin",
    symbol: "DAI",
    decimals: 18,
  },
} as const;
