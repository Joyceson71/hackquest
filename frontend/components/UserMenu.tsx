'use client';

import { useRouter } from 'next/navigation';
import { signOut } from 'aws-amplify/auth';
import { Button } from '@/components/ui/button';
import { LogOut, ShieldCheck, User, Users } from 'lucide-react';
import { useRole } from '@/lib/role-context';

export default function UserMenu() {
  const router = useRouter();
  const { role, clearRole, userEmail } = useRole();

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
      {isAdmin && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/admin/teams')}
          className="hidden md:flex font-medium text-xs h-8 px-3 transition-colors border border-border bg-card hover:bg-muted text-primary"
        >
          <Users className="h-4 w-4 mr-2" />
          Admin Teams
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push('/team')}
        className="hidden sm:flex font-medium text-xs h-8 px-3 transition-colors border border-border bg-card hover:bg-muted"
      >
        <Users className="h-4 w-4 mr-2" />
        My Team
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push('/tasks')}
        className="hidden sm:flex font-medium text-xs h-8 px-3 transition-colors border border-border bg-card hover:bg-muted"
      >
        My Tasks
      </Button>

      {/* Role badge */}
      <div
        className={`hidden sm:flex items-center gap-1.5 px-2 py-1 border text-[10px] font-semibold uppercase tracking-wider rounded-md ${
          isAdmin
            ? 'text-primary bg-primary/10 border-primary/20'
            : 'text-muted-foreground bg-muted border-border'
        }`}
      >
        {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
        {isAdmin ? 'Admin' : 'Employee'}
      </div>

      <span className="text-sm text-muted-foreground hidden sm:inline-block max-w-[140px] truncate font-medium">
        {userEmail}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        className="font-medium text-xs h-8 px-3 transition-colors border border-border bg-card hover:bg-muted"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Sign Out
      </Button>
    </div>
  );
}
