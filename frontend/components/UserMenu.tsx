'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldCheck, User } from 'lucide-react';
import { useRole } from '@/lib/role-context';

export default function UserMenu() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { role, clearRole } = useRole();

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUserEmail(user.signInDetails?.loginId || user.username))
      .catch(() => setUserEmail(null));
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      clearRole();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!userEmail) return null;

  const isAdmin = role === 'admin';

  return (
    <div className="flex items-center gap-3">
      {/* Role badge */}
      <div
        className={`hidden sm:flex items-center gap-1.5 px-2 py-1 border-2 text-xs font-black uppercase shadow-brutal-sm ${
          isAdmin
            ? 'text-background bg-primary border-border'
            : 'text-background bg-secondary border-border'
        }`}
      >
        {isAdmin ? <ShieldCheck className="h-3 w-3 stroke-[3]" /> : <User className="h-3 w-3 stroke-[3]" />}
        {isAdmin ? 'ADMIN' : 'EMPLOYEE'}
      </div>

      <span className="text-sm text-muted-foreground hidden sm:inline-block max-w-[140px] truncate">
        {userEmail}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="font-black uppercase shadow-brutal-sm border-2 border-border hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
      >
        <LogOut className="h-4 w-4 mr-2 stroke-[3]" />
        SIGN OUT
      </Button>
    </div>
  );
}
