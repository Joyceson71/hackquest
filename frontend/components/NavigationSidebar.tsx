'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRole } from '@/lib/role-context';

export default function NavigationSidebar() {
  const pathname = usePathname();
  const { role } = useRole(); // Using the existing RoleContext

  // Check if we are on the login page, if so, do not render the sidebar
  if (pathname === '/login') {
    return null;
  }

  const getLinks = () => {
    const links = [];
    
    // Admin specific links
    if (role === 'admin') {
      links.push(
        { href: '/', label: 'COMMAND', id: '01' },
        { href: '/admin/teams', label: 'SQUADS', id: '02' },
        { href: '/tasks', label: 'MISSIONS', id: '03' }, 
        { href: '/team/new-task', label: 'NEW MISSION', id: '04' },
        { href: '/meetings/new', label: 'BRIEFINGS', id: '05' },
      );
    } else {
      // Employee specific links
      links.push(
        { href: '/employee', label: 'COMMAND', id: '01' },
        { href: '/tasks', label: 'MY MISSIONS', id: '02' },
        { href: '/team', label: 'MY SQUAD', id: '03' },
      );
    }

    return links;
  };

  const navLinks = getLinks();

  return (
    <aside className="w-64 bg-card hidden md:flex flex-col sticky top-24 h-[calc(100vh-8rem)] border border-border shrink-0 z-20 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-8 px-0 space-y-2 no-scrollbar">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && link.href !== '/employee' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-baseline gap-4 px-6 py-3 transition-all relative group ${
                isActive 
                  ? 'bg-muted/30' 
                  : 'hover:bg-muted/50 hover:pl-8'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
              )}
              <span className={`meta-label ${isActive ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                {link.id}
              </span>
              <span className={`manga-header text-sm tracking-widest ${isActive ? 'text-foreground' : 'text-foreground'}`}>
                {link.label}
              </span>
              {isActive && (
                <span className="absolute right-4 text-primary opacity-50 meta-label tracking-widest text-[10px]">
                  ACTIVE
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-6 border-t border-border mt-auto bg-muted/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 text-border opacity-20 manga-header text-4xl leading-none -mt-2 -mr-2">
          //
        </div>
        <p className="meta-label mb-1">USER PROFILE</p>
        <p className="manga-header text-sm">{role === 'admin' ? 'SYSTEM LEAD' : 'OPERATIVE'}</p>
      </div>
    </aside>
  );
}
