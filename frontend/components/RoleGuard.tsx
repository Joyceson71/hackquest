'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole, UserRole } from '@/lib/role-context';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
  allowedRole: UserRole;
  children: React.ReactNode;
}

/**
 * RoleGuard — wraps a page to only allow a specific role.
 * If the user has a different role, they are redirected.
 * 
 * Usage:
 *   <RoleGuard allowedRole="admin"><AdminPage /></RoleGuard>
 *   <RoleGuard allowedRole="employee"><EmployeePage /></RoleGuard>
 */
export default function RoleGuard({ allowedRole, children }: RoleGuardProps) {
  const { role, isLoaded } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return; // Still loading
    if (role !== allowedRole) {
      if (role === 'admin') {
        router.replace('/');
      } else {
        router.replace('/employee');
      }
    }
  }, [role, allowedRole, router, isLoaded]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== allowedRole) return null;

  return <>{children}</>;
}
