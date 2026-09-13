'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { configureAmplify } from '@/lib/amplify';
import { useRole } from '@/lib/role-context';
import { Loader2 } from 'lucide-react';

configureAmplify();

// Routes accessible without any role guard
const PUBLIC_ROUTES = ['/login'];
// Routes for employees only
const EMPLOYEE_ROUTES = ['/employee'];
// Routes for admins only (everything else protected)
const ADMIN_ONLY_ROUTES = ['/meetings'];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { role, isLoaded, setRole, setUserEmail, setUserName } = useRole();

  const checkAuth = useCallback(async () => {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(true);

      // Fetch user attributes to get email and name
      try {
        const attrs = await fetchUserAttributes();
        const email = attrs.email || user.signInDetails?.loginId || user.username;
        const name = attrs.name || attrs.email || user.username;
        setUserEmail(email || null);
        setUserName(name || null);
      } catch {
        const email = user.signInDetails?.loginId || user.username;
        setUserEmail(email || null);
        setUserName(email || null);
      }

      // Role should already be set from login page selection (stored in localStorage via RoleContext)
      // If somehow missing and we are fully loaded, default to employee for safety
      if (!role && isLoaded) {
        setRole('employee');
      }

      if (pathname === '/login') {
        // Redirect to role-specific home
        if (role === 'admin') {
          router.push('/');
        } else {
          router.push('/employee');
        }
      }

      // Enforce role-based access
      const isEmployeeRoute = EMPLOYEE_ROUTES.some(r => pathname.startsWith(r));
      const isAdminRoute = ADMIN_ONLY_ROUTES.some(r => pathname.startsWith(r)) || pathname === '/';

      if (role === 'employee' && isAdminRoute) {
        router.push('/employee');
      } else if (role === 'admin' && isEmployeeRoute) {
        router.push('/');
      }

    } catch {
      setIsAuthenticated(false);
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.push('/login');
      }
    }
  }, [pathname, router, role, isLoaded, setRole, setUserEmail, setUserName]);

  useEffect(() => {
    // Only check auth once the role context has finished hydrating from localStorage
    if (!isLoaded) return;
    
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkAuth();
  }, [checkAuth, isLoaded]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Prevent flash of protected content
  if (!isAuthenticated && !PUBLIC_ROUTES.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
