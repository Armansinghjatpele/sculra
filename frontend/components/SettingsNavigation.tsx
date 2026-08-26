'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export function SettingsNavigation() {
  const pathname = usePathname();
  const tabs = [
    { title: 'Profile', href: '/settings?tab=profile' },
    { title: 'Preferences', href: '/settings?tab=preferences' },
    { title: 'Appearance', href: '/settings?tab=appearance' },
    { title: 'Notifications', href: '/settings?tab=notifications' },
    { title: 'Security', href: '/settings?tab=security' },
    { title: 'Organization', href: '/settings?tab=organization' },
    { title: 'Integrations', href: '/settings?tab=integrations' },
    { title: 'API Keys', href: '/api-keys' },
    { title: 'Billing', href: '/billing' },
  ];

  return (
    <nav className="flex flex-col space-y-1 md:w-48 shrink-0">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href.split('?')[0];
        return (
          <Link
            key={tab.title}
            href={tab.href}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            )}
          >
            {tab.title}
          </Link>
        );
      })}
    </nav>
  );
}
