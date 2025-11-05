"use client";

import { useReadContract } from "wagmi";
import { useState, useEffect } from "react";
import OracleAggregatorABI from "@/lib/contracts/abis/OracleAggregator.json";
import { formatters } from "./useUserPosition";

/**
 * Asset price information
 */
export interface AssetPrice {
  symbol: string;
  address: string;
  oraclePrice: number; // USD price from on-chain oracle
  coinGeckoPrice?: number; // USD price from CoinGecko (optional)
  deviation?: number; // Percentage deviation (0-100)
  hasDeviation: boolean; // True if deviation > 5%
  isStablecoin: boolean; // True for USDC/DAI
  lastUpdated: Date;
}

/**
 * Oracle prices response
 */
export interface OraclePrices {
  ETH: AssetPrice;
  USDC: AssetPrice;
  DAI: AssetPrice;
}

/**
 * CoinGecko API response type
 */
interface CoinGeckoResponse {
  ethereum?: { usd: number };
  "usd-coin"?: { usd: number };
  dai?: { usd: number };
}

/**
 * Custom hook to fetch asset prices from OracleAggregator and compare with CoinGecko
 *
 * IMPORTANT NOTES:
 * - On testnet, USDC and DAI prices are hardcoded to $1.00 (oracle mocks)
 * - ETH price is fetched from Chainlink oracle
 * - CoinGecko comparison is optional and for display only
 * - Deviation warnings trigger when oracle vs CoinGecko > 5%
 *
 * Usage:
 * ```tsx
 * const { prices, isLoading, error } = useOraclePrices({ fetchCoinGecko: true });
 *
 * console.log(`ETH Price: $${prices.ETH.oraclePrice}`);
 * if (prices.ETH.hasDeviation) {
 *   console.warn(`Price deviation detected: ${prices.ETH.deviation}%`);
 * }
 * ```
 *
 * @param options.fetchCoinGecko - Whether to fetch CoinGecko prices for comparison
 * @returns {Object} Oracle prices with deviation warnings
 * - prices: Asset prices (ETH, USDC, DAI)
 * - isLoading: Boolean loading state
 * - error: Error message if fetching failed
 * - refetch: Function to manually refetch prices
 */
export function useOraclePrices(options?: { fetchCoinGecko?: boolean }) {
  const fetchCoinGecko = options?.fetchCoinGecko ?? false;
  const [coinGeckoPrices, setCoinGeckoPrices] = useState<CoinGeckoResponse | null>(null);
  const [coinGeckoError, setCoinGeckoError] = useState<string | null>(null);

  // Contract addresses
  const oracleAddress = process.env.NEXT_PUBLIC_ORACLE_AGGREGATOR_ADDRESS as `0x${string}`;
  const ethAddress = process.env.NEXT_PUBLIC_ETH_ADDRESS as `0x${string}`;
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
  const daiAddress = process.env.NEXT_PUBLIC_DAI_ADDRESS as `0x${string}`;

  // Fetch ETH price from OracleAggregator
  const { data: ethPriceRaw, isLoading: ethLoading, error: ethError, refetch: refetchEth } = useReadContract({
    address: oracleAddress,
    abi: OracleAggregatorABI.abi,
    functionName: "getPrice",
    args: [ethAddress],
  });

  // Fetch USDC price from OracleAggregator
  const { data: usdcPriceRaw, isLoading: usdcLoading, error: usdcError, refetch: refetchUsdc } = useReadContract({
    address: oracleAddress,
    abi: OracleAggregatorABI.abi,
    functionName: "getPrice",
    args: [usdcAddress],
  });

  // Fetch DAI price from OracleAggregator
  const { data: daiPriceRaw, isLoading: daiLoading, error: daiError, refetch: refetchDai } = useReadContract({
    address: oracleAddress,
    abi: OracleAggregatorABI.abi,
    functionName: "getPrice",
    args: [daiAddress],
  });

  // Convert oracle prices (8 decimals - Chainlink format) to numbers
  const ethOraclePrice = ethPriceRaw ? formatters.usdToNumber(ethPriceRaw.toString()) : 0;
  const usdcOraclePrice = usdcPriceRaw ? formatters.usdToNumber(usdcPriceRaw.toString()) : 1.0;
  const daiOraclePrice = daiPriceRaw ? formatters.usdToNumber(daiPriceRaw.toString()) : 1.0;

  // Fetch CoinGecko prices (optional, for comparison)
  useEffect(() => {
    if (!fetchCoinGecko) return;

    const fetchCoinGeckoPrices = async () => {
      try {
        const response = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin,dai&vs_currencies=usd",
          {
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data: CoinGeckoResponse = await response.json();
        setCoinGeckoPrices(data);
        setCoinGeckoError(null);
      } catch (err) {
        console.error("Failed to fetch CoinGecko prices:", err);
        setCoinGeckoError(err instanceof Error ? err.message : "Unknown error");
      }
    };

    fetchCoinGeckoPrices();

    // Refresh CoinGecko prices every 60 seconds
    const interval = setInterval(fetchCoinGeckoPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchCoinGecko]);

  // Calculate deviation percentage
  const calculateDeviation = (oraclePrice: number, marketPrice?: number): number => {
    if (!marketPrice || marketPrice === 0) return 0;
    return Math.abs(((oraclePrice - marketPrice) / marketPrice) * 100);
  };

  // Build asset price objects
  const prices: OraclePrices = {
    ETH: {
      symbol: "ETH",
      address: ethAddress,
      oraclePrice: ethOraclePrice,
      coinGeckoPrice: coinGeckoPrices?.ethereum?.usd,
      deviation: calculateDeviation(ethOraclePrice, coinGeckoPrices?.ethereum?.usd),
      hasDeviation: calculateDeviation(ethOraclePrice, coinGeckoPrices?.ethereum?.usd) > 5,
      isStablecoin: false,
      lastUpdated: new Date(),
    },
    USDC: {
      symbol: "USDC",
      address: usdcAddress,
      oraclePrice: usdcOraclePrice,
      coinGeckoPrice: coinGeckoPrices?.["usd-coin"]?.usd,
      deviation: calculateDeviation(usdcOraclePrice, coinGeckoPrices?.["usd-coin"]?.usd),
      hasDeviation: false, // Stablecoins always $1 on testnet
      isStablecoin: true,
      lastUpdated: new Date(),
    },
    DAI: {
      symbol: "DAI",
      address: daiAddress,
      oraclePrice: daiOraclePrice,
      coinGeckoPrice: coinGeckoPrices?.dai?.usd,
      deviation: calculateDeviation(daiOraclePrice, coinGeckoPrices?.dai?.usd),
      hasDeviation: false, // Stablecoins always $1 on testnet
      isStablecoin: true,
      lastUpdated: new Date(),
    },
  };

  const isLoading = ethLoading || usdcLoading || daiLoading;
  const error = ethError || usdcError || daiError || coinGeckoError;

  const refetch = () => {
    refetchEth();
    refetchUsdc();
    refetchDai();
  };

  return {
    prices,
    isLoading,
    error: error ? String(error) : null,
    refetch,
  };
}
