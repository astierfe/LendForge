import { useAccount } from 'wagmi';
import { useMemo } from 'react';

/**
 * Check if connected wallet is the DEPLOYER address
 *
 * @returns {Object} Admin access state
 * - isAdmin: true if connected wallet matches DEPLOYER_ADDRESS
 * - isLoading: true while wallet connection is pending
 * - deployerAddress: the configured deployer address
 */
export function useAdminAccess() {
  const { address, isConnecting } = useAccount();

  const deployerAddress = process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS?.toLowerCase();

  const isAdmin = useMemo(() => {
    if (!address || !deployerAddress) return false;
    return address.toLowerCase() === deployerAddress;
  }, [address, deployerAddress]);

  return {
    isAdmin,
    isLoading: isConnecting,
    deployerAddress,
  };
}
