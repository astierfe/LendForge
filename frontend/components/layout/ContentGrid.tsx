import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ContentGridProps {
  children: ReactNode;
  className?: string;
  cols?: 1 | 2 | 3 | 4;
}

/**
 * Responsive grid layout for dashboard content
 * Usage: Display cards/widgets in a responsive grid
 */
export function ContentGrid({ children, className, cols = 3 }: ContentGridProps) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6', gridClasses[cols], className)}>
      {children}
    </div>
  );
}
