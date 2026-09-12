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
        className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${
          isAdmin
            ? 'text-violet-400 bg-violet-400/10 border-violet-400/20'
            : 'text-blue-400 bg-blue-400/10 border-blue-400/20'
        }`}
      >
        {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
        {isAdmin ? 'Admin' : 'Employee'}
      </div>

      <span className="text-sm text-muted-foreground hidden sm:inline-block max-w-[140px] truncate">
        {userEmail}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
