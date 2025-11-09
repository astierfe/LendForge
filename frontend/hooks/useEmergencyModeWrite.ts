import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useState } from 'react';
import { CONTRACTS } from '@/lib/contracts/addresses';
import OracleAggregatorABI from '@/lib/contracts/abis/OracleAggregator.json';

/**
 * Write operations for OracleAggregator emergency mode
 *
 * @returns {Object} Emergency mode write state
 * - toggleEmergencyMode: Function to enable/disable emergency mode
 * - isPending: true while transaction is pending
 * - error: error message if transaction failed
 */
export function useEmergencyModeWrite() {
  const [error, setError] = useState<string | null>(null);

  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const toggleEmergencyMode = async (enabled: boolean, reason: string) => {
    if (!reason && enabled) {
      setError('Reason is required when enabling emergency mode');
      return;
    }

    try {
      setError(null);
      await writeContract({
        address: CONTRACTS.ORACLE_AGGREGATOR as `0x${string}`,
        abi: OracleAggregatorABI.abi,
        functionName: 'setEmergencyMode',
        args: [enabled, reason || ''],
      });
    } catch (err: any) {
      setError(err.message || 'Failed to toggle emergency mode');
    }
  };

  return {
    toggleEmergencyMode,
    isPending: isWritePending || isConfirming,
    error,
    transactionHash: hash,
  };
}
