'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { verifySession } from '@/lib/utils/auth';

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

  // On login page, render immediately
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Still checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]"></div>
      </div>
    );
  }

  // Not authenticated (will redirect)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]"></div>
      </div>
    );
  }

  // Authenticated
  return <>{children}</>;
}
