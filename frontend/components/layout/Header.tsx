'use client';

import { ConnectButton } from '@/components/wallet/ConnectButton';
import { NetworkBadge } from '@/components/wallet/NetworkBadge';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold">{title}</h1>

        <div className="flex items-center gap-4">
          <NetworkBadge />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
