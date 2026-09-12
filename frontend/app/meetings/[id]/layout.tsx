'use client';

import { usePathname } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { authenticatedFetch } from '@/lib/api';

export default function MeetingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const [escalationCount, setEscalationCount] = useState(0);

  // Live badge: count pending escalations for this meeting
  useEffect(() => {
    const fetchBadge = async () => {
      try {
        const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
        const res = await authenticatedFetch(`${apiUrl}/meetings/${id}/escalations`);
        if (res.ok) {
          const data = await res.json();
          setEscalationCount(Array.isArray(data) ? data.length : 0);
        }
      } catch { /* silent */ }
    };
    fetchBadge();
    // Refresh badge every 60 seconds
    const interval = setInterval(fetchBadge, 60_000);
    return () => clearInterval(interval);
  }, [id]);

  const tabs = [
    { label: 'Transcript',   href: `/meetings/${id}/transcript` },
    { label: 'Review',       href: `/meetings/${id}/review` },
    { label: 'Action Board', href: `/meetings/${id}/actions` },
    { label: 'Participants', href: `/meetings/${id}/participants` },
    {
      label: escalationCount > 0 ? `Escalations (${escalationCount})` : 'Escalations',
      href: `/meetings/${id}/escalations`,
      alert: escalationCount > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b-4 border-border overflow-x-auto" aria-label="Meeting screens">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`
                relative px-4 py-2.5 text-sm font-black uppercase tracking-wide transition-colors duration-200 whitespace-nowrap
                border-b-4 -mb-[4px]
                ${isActive
                  ? 'border-primary text-primary bg-primary/5'
                  : tab.alert
                  ? 'border-destructive text-destructive hover:bg-destructive/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              {tab.label}
              {tab.alert && (
                <span className="absolute -top-1 -right-1 bg-destructive text-background text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-border">
                  {escalationCount}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
