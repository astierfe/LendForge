'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutDashboard, PlusCircle, TrendingDown, ArrowUpFromLine, ArrowDownFromLine, Wallet, BarChart3 } from 'lucide-react';

const navItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Deposit',
    href: '/deposit',
    icon: PlusCircle,
  },
  {
    title: 'Borrow',
    href: '/borrow',
    icon: TrendingDown,
  },
  {
    title: 'Repay',
    href: '/repay',
    icon: ArrowUpFromLine,
  },
  {
    title: 'Withdraw',
    href: '/withdraw',
    icon: ArrowDownFromLine,
  },
  {
    title: 'Positions',
    href: '/positions',
    icon: Wallet,
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r bg-muted/40 p-4 hidden md:block">
      <div className="space-y-4">
        {/* Logo */}
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-full" />
          <h1 className="text-xl font-bold">LendForge</h1>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
