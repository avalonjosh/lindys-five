'use client';

import { usePathname } from 'next/navigation';
import AdminNav from './AdminNav';

/**
 * Shared visual chrome for every admin page: dark slate background and
 * the AdminNav header. The login page renders bare (it has its own look
 * and shouldn't show navigation).
 *
 * Section components should NOT render AdminNav or their own full-screen
 * background wrappers — just their page content.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <AdminNav />
      {children}
    </div>
  );
}
