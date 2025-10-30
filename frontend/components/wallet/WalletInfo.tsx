'use client';

import { useAccount, useBalance } from 'wagmi';
import { Card, CardContent } from '@/components/ui/card';

export function WalletInfo() {
  const { address } = useAccount();
  const { data: balance } = useBalance({ address });

  if (!address) {
    return null;
  }

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <Card className="w-full">
      <CardContent className="pt-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Address</span>
            <span className="text-sm font-mono">{shortAddress}</span>
          </div>
          {balance && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Balance</span>
              <span className="text-sm font-medium">
                {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
