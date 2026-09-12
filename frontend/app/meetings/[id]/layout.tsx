'use client';

import { usePathname } from 'next/navigation';
import { use } from 'react';

export default function MeetingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();

  const tabs = [
    { label: 'Transcript', href: `/meetings/${id}/transcript` },
    { label: 'Review', href: `/meetings/${id}/review` },
    { label: 'Action Board', href: `/meetings/${id}/actions` },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-border" aria-label="Meeting screens">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <a
              key={tab.href}
              href={tab.href}
              className={`
                px-4 py-2.5 text-sm font-medium transition-colors duration-200
                border-b-2 -mb-px
                ${isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }
              `}
            >
              {tab.label}
            </a>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
