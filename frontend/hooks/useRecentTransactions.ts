"use client";

import { useSuspenseQuery } from "@apollo/experimental-nextjs-app-support/ssr";
import { useState } from "react";
import { GET_RECENT_TRANSACTIONS } from "@/lib/graphql/queries/metrics";
import { formatters } from "./useUserPosition";

/**
 * Transaction types from subgraph schema
 */
export type TransactionType =
  | "DEPOSIT_ETH"
  | "DEPOSIT_ERC20"
  | "BORROW"
  | "REPAY"
  | "WITHDRAW_ETH"
  | "WITHDRAW_ERC20"
  | "LIQUIDATION";

/**
 * Type definitions for Transaction query response
 */
export interface TransactionData {
  id: string;
  type: TransactionType;
  asset: string | null; // Asset address (can be null for ETH)
  amount: string; // BigInt as string
  timestamp: string; // Unix timestamp as string
  txHash: string; // Transaction hash
  user: {
    id: string;
  };
}

export interface TransactionsResponse {
  transactions: TransactionData[];
}

/**
 * Formatted transaction for display
 */
export interface FormattedTransaction {
  id: string;
  type: TransactionType;
  typeLabel: string; // "Deposit", "Borrow", "Repay", etc.
  assetSymbol: string; // "ETH" | "USDC" | "DAI"
  assetAddress: string | null;
  amount: number; // Token amount (not USD)
  amountFormatted: string; // e.g., "1.5 ETH"
  userAddress: string;
  userAddressTruncated: string;
  timestamp: Date;
  timestampLabel: string; // e.g., "2 hours ago"
  txHash: string;
  etherscanUrl: string;
}

/**
 * Transaction type filter options
 */
export type TransactionTypeFilter = "all" | "deposits" | "borrows" | "repays" | "withdrawals";

/**
 * Map asset address to symbol
 */
const getAssetSymbol = (address: string | null, txType: TransactionType): string => {
  if (!address) {
    // If no asset address, check transaction type
    // ETH operations (deposits, withdrawals) + BORROW/REPAY always use ETH
    if (
      txType === "DEPOSIT_ETH" ||
      txType === "WITHDRAW_ETH" ||
      txType === "BORROW" ||
      txType === "REPAY"
    ) {
      return "ETH";
    }
    return "UNKNOWN";
  }

  const ethAddress = process.env.NEXT_PUBLIC_ETH_ADDRESS?.toLowerCase();
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_ADDRESS?.toLowerCase();
  const daiAddress = process.env.NEXT_PUBLIC_DAI_ADDRESS?.toLowerCase();

  const assetLower = address.toLowerCase();

  if (assetLower === ethAddress) return "ETH";
  if (assetLower === usdcAddress) return "USDC";
  if (assetLower === daiAddress) return "DAI";

  return "UNKNOWN";
};

/**
 * Get human-readable label for transaction type
 */
const getTypeLabel = (type: TransactionType): string => {
  switch (type) {
    case "DEPOSIT_ETH":
    case "DEPOSIT_ERC20":
      return "Deposit";
    case "BORROW":
      return "Borrow";
    case "REPAY":
      return "Repay";
    case "WITHDRAW_ETH":
    case "WITHDRAW_ERC20":
      return "Withdraw";
    case "LIQUIDATION":
      return "Liquidation";
    default:
      return type;
  }
};

/**
 * Truncate Ethereum address for display
 */
const truncateAddress = (address: string): string => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format timestamp as relative time (e.g., "2 hours ago")
 */
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

/**
 * Format amount with asset symbol
 */
const formatAmount = (amount: number, symbol: string): string => {
  // Format with appropriate decimal places
  const decimals = symbol === "USDC" ? 2 : 4;
  return `${amount.toFixed(decimals)} ${symbol}`;
};

/**
 * Convert TransactionTypeFilter to GraphQL enum array
 */
const getTransactionTypes = (filter: TransactionTypeFilter): TransactionType[] => {
  switch (filter) {
    case "deposits":
      return ["DEPOSIT_ETH", "DEPOSIT_ERC20"];
    case "borrows":
      return ["BORROW"];
    case "repays":
      return ["REPAY"];
    case "withdrawals":
      return ["WITHDRAW_ETH", "WITHDRAW_ERC20"];
    case "all":
    default:
      return [
        "DEPOSIT_ETH",
        "DEPOSIT_ERC20",
        "BORROW",
        "REPAY",
        "WITHDRAW_ETH",
        "WITHDRAW_ERC20",
      ];
  }
};

/**
 * Custom hook to fetch recent protocol transactions
 *
 * Usage:
 * ```tsx
 * const { transactions, typeFilter, setTypeFilter } = useRecentTransactions({ first: 10 });
 *
 * // Display transactions
 * {transactions.map(tx => (
 *   <div key={tx.id}>
 *     {tx.typeLabel}: {tx.amountFormatted} by {tx.userAddressTruncated}
 *   </div>
 * ))}
 *
 * // Change filter
 * <button onClick={() => setTypeFilter("deposits")}>Show Deposits</button>
 * ```
 *
 * @param options.first - Number of transactions to fetch (default: 10)
 * @param options.defaultTypeFilter - Default transaction type filter (default: "all")
 * @returns {Object} Transactions with filter controls
 * - transactions: Array of formatted transactions
 * - rawData: Raw subgraph data
 * - typeFilter: Current transaction type filter
 * - setTypeFilter: Function to change filter
 * - isLoading: Boolean loading state
 * - error: Error object if query failed
 */
export function useRecentTransactions(options?: {
  first?: number;
  defaultTypeFilter?: TransactionTypeFilter;
}) {
  const first = options?.first ?? 10;
  const [typeFilter, setTypeFilter] = useState<TransactionTypeFilter>(
    options?.defaultTypeFilter ?? "all"
  );

  const transactionTypes = getTransactionTypes(typeFilter);

  // Fetch transactions from subgraph
  const { data, error } = useSuspenseQuery<TransactionsResponse>(
    GET_RECENT_TRANSACTIONS,
    {
      variables: {
        first,
        types: transactionTypes,
      },
    }
  );

  const transactionsData = data?.transactions ?? [];

  // Format transactions
  const formattedTransactions: FormattedTransaction[] = transactionsData.map((tx) => {
    const timestamp = parseInt(tx.timestamp);
    const date = new Date(timestamp * 1000);
    const assetSymbol = getAssetSymbol(tx.asset, tx.type);

    // Convert amount based on asset decimals (ANO_002 workaround)
    const amount =
      assetSymbol === "USDC"
        ? formatters.tokenToNumber(tx.amount, 6, "USDC")
        : formatters.weiToEth(tx.amount);

    const etherscanUrl = `https://sepolia.etherscan.io/tx/${tx.txHash}`;

    return {
      id: tx.id,
      type: tx.type,
      typeLabel: getTypeLabel(tx.type),
      assetSymbol,
      assetAddress: tx.asset,
      amount,
      amountFormatted: formatAmount(amount, assetSymbol),
      userAddress: tx.user.id,
      userAddressTruncated: truncateAddress(tx.user.id),
      timestamp: date,
      timestampLabel: formatRelativeTime(date),
      txHash: tx.txHash,
      etherscanUrl,
    };
  });

  return {
    transactions: formattedTransactions,
    rawData: transactionsData,
    typeFilter,
    setTypeFilter,
    isLoading: !data,
    error,
  };
}
