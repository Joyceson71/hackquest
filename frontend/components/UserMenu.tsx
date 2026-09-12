'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, getCurrentUser } from 'aws-amplify/auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export default function UserMenu() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUserEmail(user.signInDetails?.loginId || user.username))
      .catch(() => setUserEmail(null));
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!userEmail) return null;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground hidden sm:inline-block">{userEmail}</span>
      <Button variant="outline" size="sm" onClick={handleSignOut}>
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
