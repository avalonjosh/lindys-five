'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { verifySession } from '@/lib/utils/auth';
import { Spinner } from './ui';

/**
 * Client-side session check layered on top of the middleware gate — catches
 * expired sessions during long-lived tabs and redirects to login.
 */
export default function AdminAuthWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) {
      setIsAuthenticated(true);
      return;
    }

    async function checkAuth() {
      const authenticated = await verifySession();
      setIsAuthenticated(authenticated);

      if (!authenticated) {
        router.replace('/admin/login');
      }
    }
    checkAuth();
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  return <>{children}</>;
}
