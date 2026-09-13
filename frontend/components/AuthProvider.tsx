'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { configureAmplify } from '@/lib/amplify';
import { useRole, isAdminEmail } from '@/lib/role-context';
import { Loader2 } from 'lucide-react';

configureAmplify();

// Routes accessible without authentication
const PUBLIC_ROUTES = ['/login'];

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
      let email: string | null = null;
      let name: string | null = null;
      try {
        const attrs = await fetchUserAttributes();
        email = attrs.email || user.signInDetails?.loginId || user.username || null;
        name = attrs.name || attrs.email || user.username || null;
      } catch {
        email = user.signInDetails?.loginId || user.username || null;
        name = email;
      }

      if (email) setUserEmail(email);
      if (name) setUserName(name);

      // If role is missing (e.g. hard refresh, cleared storage), derive it from email
      // so admins never accidentally get treated as employees.
      if (!role && isLoaded) {
        const derivedRole = email && isAdminEmail(email) ? 'admin' : 'employee';
        setRole(derivedRole);
        if (pathname === '/login') {
          router.push(derivedRole === 'admin' ? '/' : '/employee');
        }
        return;
      }

      // Role exists — only redirect away from /login
      if (pathname === '/login' && role) {
        router.push(role === 'admin' ? '/' : '/employee');
      }

    } catch {
      // Not authenticated — go to login
      setIsAuthenticated(false);
      if (!PUBLIC_ROUTES.includes(pathname)) {
        router.push('/login');
      }
    }
  }, [pathname, router, role, isLoaded, setRole, setUserEmail, setUserName]);

  useEffect(() => {
    // Only run once the role context has hydrated from localStorage
    if (!isLoaded) return;
    checkAuth();
  }, [checkAuth, isLoaded]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated && !PUBLIC_ROUTES.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
