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
    <aside className="w-64 glass-panel hidden md:flex flex-col sticky top-[88px] h-[calc(100vh-104px)] mx-4 ml-6 rounded-xl shadow-2xl">
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2 no-scrollbar">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && link.href !== '/employee' && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive 
                  ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,229,255,0.15)]' 
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-transparent'
              }`}
            >
              <link.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
