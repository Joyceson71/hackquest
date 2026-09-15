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
      <nav className="flex gap-6 border-b border-border overflow-x-auto px-1" aria-label="Meeting screens">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`
                relative py-3 text-sm font-medium transition-colors duration-200 whitespace-nowrap
                border-b-2 -mb-[1px]
                ${isActive
                  ? 'border-primary text-primary'
                  : tab.alert
                  ? 'border-transparent text-destructive hover:text-destructive/80'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <div className="flex items-center gap-1.5">
                {tab.label}
                {tab.alert && (
                  <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {escalationCount}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
