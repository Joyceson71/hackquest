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
        { href: '/', label: 'HOME', id: '01' },
        { href: '/admin/teams', label: 'TEAMS', id: '02' },
        { href: '/tasks', label: 'TASKS', id: '03' }, 
        { href: '/team/new-task', label: 'NEW TASK', id: '04' },
        { href: '/meetings/new', label: 'MEETINGS', id: '05' },
      );
    } else {
      // Employee specific links
      links.push(
        { href: '/employee', label: 'HOME', id: '01' },
        { href: '/tasks', label: 'MY TASKS', id: '02' },
        { href: '/team', label: 'MY TEAM', id: '03' },
      );
    }

    return links;
  };

  const navLinks = getLinks();

  return (
    <aside className="w-56 bg-background hidden md:flex flex-col sticky top-16 h-[calc(100vh-4rem)] border-r border-border shrink-0 z-20">
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-8 px-0 space-y-0 no-scrollbar">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && link.href !== '/employee' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-baseline gap-4 px-6 py-3 transition-colors ${
                isActive 
                  ? 'border-l-2 border-foreground' 
                  : 'border-l-2 border-transparent hover:bg-muted/50'
              }`}
            >
              <span className={`meta-text ${isActive ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>{link.id}</span>
              <span className={`meta-text ${isActive ? 'text-foreground font-bold' : 'text-foreground'}`}>{link.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-6 border-t border-border mt-auto">
        <p className="editorial-heading text-xs text-muted-foreground mb-1">CURRENT USER</p>
        <p className="meta-text text-foreground">{role === 'admin' ? 'LEAD / ADMIN' : 'MEMBER'}</p>
      </div>
    </aside>
  );
}
