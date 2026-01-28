import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { verifySession } from '../../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    async function checkAuth() {
      const authenticated = await verifySession();
      setIsAuthenticated(authenticated);
    }
    checkAuth();
  }, [location.pathname]);

  // Still checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]"></div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Authenticated
  return <>{children}</>;
}
