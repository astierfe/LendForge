'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isConnected } = useAccount();

  // Redirect to landing page if wallet is not connected
  useEffect(() => {
    if (!isConnected) {
      router.push('/');
    }
  }, [isConnected, router]);

  // Don't render content if not connected (will redirect)
  if (!isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <MobileNav />
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
