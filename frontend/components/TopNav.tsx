'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/UserMenu';

export default function TopNav() {
  const pathname = usePathname();

  // Hide on login screen
  if (pathname === '/login') return null;

  return (
    <header className="h-16 shrink-0 bg-background border-b-2 border-border sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 shadow-[0_4px_0_0_rgba(26,26,26,0.05)]">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-4 h-4 bg-primary border border-foreground" />
          <span className="manga-header text-2xl tracking-[0.2em] text-foreground">HACKQUEST</span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <UserMenu />
      </div>
    </header>
  );
}
