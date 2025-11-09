import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState } from 'react';
import { CONTRACTS, TOKENS } from '@/lib/contracts/addresses';
import PriceRegistryABI from '@/lib/contracts/abis/PriceRegistry.json';
import ManualPriceProviderABI from '@/lib/contracts/abis/ManualPriceProvider.json';

/**
 * Manage price providers for USDC and DAI (ManualPriceProvider)
 * ETH uses Chainlink and cannot be modified via this hook
 *
 * @returns {Object} Price provider management state
 * - usdcProvider: USDC ManualPriceProvider address
 * - daiProvider: DAI ManualPriceProvider address
 * - setUSDCPrice: Function to update USDC price
 * - setDAIPrice: Function to update DAI price
 * - isPending: true while transaction is pending
 * - error: error message if transaction failed
 */
export function usePriceProviders() {
  const [error, setError] = useState<string | null>(null);

  // Read USDC provider address from PriceRegistry
  const { data: usdcProvider } = useReadContract({
    address: process.env.NEXT_PUBLIC_PRICE_REGISTRY_ADDRESS as `0x${string}`,
    abi: PriceRegistryABI.abi,
    functionName: 'getPrimaryProvider',
    args: [TOKENS.USDC],
  });

  // Read DAI provider address from PriceRegistry
  const { data: daiProvider } = useReadContract({
    address: process.env.NEXT_PUBLIC_PRICE_REGISTRY_ADDRESS as `0x${string}`,
    abi: PriceRegistryABI.abi,
    functionName: 'getPrimaryProvider',
    args: [TOKENS.DAI],
  });

  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const setUSDCPrice = async (priceUSD: number) => {
    if (!usdcProvider) {
      setError('USDC provider address not loaded');
      return;
    }

    try {
      setError(null);
      // Convert to 8-decimal format (Chainlink standard)
      // e.g., $1.00 → 100000000
      const price8Decimals = BigInt(Math.floor(priceUSD * 1e8));

      await writeContract({
        address: usdcProvider as `0x${string}`,
        abi: ManualPriceProviderABI.abi,
        functionName: 'setPrice',
        args: [price8Decimals],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to set USDC price');
    }
  };

  const setDAIPrice = async (priceUSD: number) => {
    if (!daiProvider) {
      setError('DAI provider address not loaded');
      return;
    }

    try {
      setError(null);
      // Convert to 8-decimal format (Chainlink standard)
      // e.g., $1.00 → 100000000
      const price8Decimals = BigInt(Math.floor(priceUSD * 1e8));

      await writeContract({
        address: daiProvider as `0x${string}`,
        abi: ManualPriceProviderABI.abi,
        functionName: 'setPrice',
        args: [price8Decimals],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to set DAI price');
    }
  };

  return {
    usdcProvider: usdcProvider as `0x${string}` | undefined,
    daiProvider: daiProvider as `0x${string}` | undefined,
    setUSDCPrice,
    setDAIPrice,
    isPending: isWritePending || isConfirming,
    error,
    transactionHash: hash,
  };
}
