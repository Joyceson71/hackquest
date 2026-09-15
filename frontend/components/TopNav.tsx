'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/UserMenu';

export default function TopNav() {
  const pathname = usePathname();

  // Hide on login screen
  if (pathname === '/login') return null;

  return (
    <header className="h-16 shrink-0 bg-background border-b border-border sticky top-0 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="editorial-heading text-xl text-foreground">HACKQUEST</span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <UserMenu />
      </div>
    </header>
  );
}
