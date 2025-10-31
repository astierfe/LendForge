import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

/**
 * Container for authenticated pages
 * Provides consistent spacing and layout
 * Usage: Wrap page content in authenticated routes
 */
export function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="flex-1 p-6 space-y-6">
      {children}
    </div>
  );
}
