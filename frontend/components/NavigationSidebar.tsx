'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Settings, 
  FileAudio,
  LogOut
} from 'lucide-react';
import UserMenu from '@/components/UserMenu';
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
        { href: '/', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/teams', label: 'Teams', icon: Users },
        { href: '/tasks', label: 'Tasks', icon: CheckSquare }, 
        { href: '/team/new-task', label: 'New Task', icon: CheckSquare },
        { href: '/meetings/new', label: 'Upload Transcript', icon: FileAudio },
      );
    } else {
      // Employee specific links
      links.push(
        { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
        { href: '/team', label: 'My Team', icon: Users },
      );
    }

    return links;
  };

  const navLinks = getLinks();

  return (
    <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col min-h-screen sticky top-0 h-screen">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <svg className="h-5 w-5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-foreground text-lg tracking-tight">HackQuest</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 no-scrollbar">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && link.href !== '/employee' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <link.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* User Area */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex items-center justify-between w-full">
           <UserMenu />
        </div>
      </div>
    </aside>
  );
}
