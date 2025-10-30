'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@/components/wallet/ConnectButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Users, TrendingUp } from 'lucide-react';

// Temporary mock data until Apollo is fully configured
const useMockGlobalMetrics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setData({
        globalMetrics: [{
          totalCollateralUSD: 0,
          totalActivePositions: 0,
          totalBorrowed: 0,
        }]
      });
      setLoading(false);
    }, 1000);
  }, []);

  return { data, loading };
};

export default function LandingPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { data, loading } = useMockGlobalMetrics();

  // Redirect to dashboard if wallet is connected
  useEffect(() => {
    if (isConnected) {
      router.push('/dashboard');
    }
  }, [isConnected, router]);

  const globalMetrics = data?.globalMetrics?.[0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-full" />
            <h1 className="text-2xl font-bold">LendForge</h1>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center py-20">
        <div className="container mx-auto px-4 text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold tracking-tight">
              Multi-Collateral Lending Protocol
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Deposit ETH, USDC, or DAI as collateral and borrow ETH with transparent, oracle-backed pricing
            </p>
          </div>

          <div className="pt-4">
            <ConnectButton />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-12 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Multi-Asset Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Deposit ETH, USDC, or DAI as collateral with optimized LTV ratios
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Secure Oracles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Chainlink price feeds with Uniswap TWAP fallback for maximum reliability
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Transparent Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Real-time on-chain data indexed by The Graph subgraph
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="border-t bg-muted/50">
        <div className="container mx-auto px-4 py-8">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardDescription>Total Value Locked</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="text-3xl font-bold">
                    ${globalMetrics?.totalCollateralUSD?.toLocaleString() || '0'}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Active Positions</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <p className="text-3xl font-bold">
                    {globalMetrics?.totalActivePositions || 0}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Total Borrowed</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <p className="text-3xl font-bold">
                    {globalMetrics?.totalBorrowed?.toFixed(2) || '0'} ETH
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>LendForge v4.3.0 - Sepolia Testnet</p>
        </div>
      </footer>
    </div>
  );
}
