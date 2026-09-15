'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/UserMenu';

export default function TopNav() {
  const pathname = usePathname();

  // Hide on login screen
  if (pathname === '/login') return null;

  return (
    <header className="h-16 shrink-0 glass-panel border-b border-border/50 sticky top-0 z-50 flex items-center justify-between px-6 mx-4 mt-4 rounded-xl shadow-2xl">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center border border-primary/30 group-hover:bg-primary/30 transition-all shadow-[0_0_15px_rgba(0,229,255,0.3)]">
            <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-foreground text-lg tracking-tight">HackQuest</span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <UserMenu />
      </div>
    </header>
  );
}
