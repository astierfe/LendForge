'use client';

import { useAccount, useChainId } from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { SEPOLIA_CHAIN_ID } from '@/lib/contracts/addresses';

export function NetworkBadge() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  if (!isConnected) {
    return null;
  }

  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;

  return (
    <Badge variant={isCorrectNetwork ? 'default' : 'destructive'}>
      {isCorrectNetwork ? (
        <CheckCircle className="w-3 h-3 mr-1" />
      ) : (
        <AlertCircle className="w-3 h-3 mr-1" />
      )}
      {isCorrectNetwork ? 'Sepolia' : 'Wrong Network'}
    </Badge>
  );
}
