'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrganization, useUser, SignOutButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

interface AppSidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (c: boolean) => void;
}

export function AppSidebar({ isCollapsed, setIsCollapsed }: AppSidebarProps) {
  const pathname = usePathname();
  const { organization } = useOrganization();
  const { user } = useUser();

  const groups = [
    {
      title: 'Overview',
      items: [
        { title: 'Dashboard', href: '/dashboard', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="9" rx="1" />
            <rect x="14" y="3" width="7" height="5" rx="1" />
            <rect x="14" y="12" width="7" height="9" rx="1" />
            <rect x="3" y="16" width="7" height="5" rx="1" />
          </svg>
        )},
      ],
    },
    {
      title: 'Testing',
      items: [
        { title: 'Projects', href: '/projects', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        )},
        { title: 'Test Runs', href: '/test-runs', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
            <path d="M12 6v6l4 2" />
          </svg>
        )},
        { title: 'Issues', href: '/issues', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )},
        { title: 'Reports', href: '/reports', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        )},
      ],
    },
    {
      title: 'Workspace',
      items: [
        { title: 'Team', href: '/team', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        )},
        { title: 'Activity', href: '/activity', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        )},
      ],
    },
    {
      title: 'System',
      items: [
        { title: 'Settings', href: '/settings', icon: (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        )},
      ],
    },
  ];

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-border bg-zinc-950 transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-16 p-2.5' : 'w-64 p-4'
      )}
    >
      {/* Top logo */}
      <div className="mb-6 flex flex-col gap-4">
        <Link href="/" className="flex items-center space-x-2.5 px-2 select-none self-start">
          <svg className="h-5 w-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {!isCollapsed && (
            <span className="font-extrabold tracking-tight text-foreground text-sm uppercase">Sculra</span>
          )}
        </Link>

        {!isCollapsed && <WorkspaceSwitcher />}
      </div>

      {/* Nav groups list */}
      <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
        {groups.map((g, gIdx) => (
          <div key={gIdx} className="space-y-1.5">
            {!isCollapsed && (
              <span className="px-3 text-[9px] uppercase font-bold tracking-widest text-muted-foreground block">
                {g.title}
              </span>
            )}
            <div className="space-y-0.5">
              {g.items.map((item, iIdx) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={iIdx}
                    href={item.href}
                    className={cn(
                      'flex items-center rounded-md py-1.5 px-3 text-xs font-semibold transition-all duration-150 relative group',
                      isActive
                        ? 'bg-zinc-900 text-accent'
                        : 'text-muted-foreground hover:bg-zinc-900/50 hover:text-foreground',
                      isCollapsed ? 'justify-center px-0' : 'space-x-3'
                    )}
                  >
                    {/* Active left tiny cyan indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-accent rounded-r" />
                    )}
                    {item.icon}
                    {!isCollapsed && <span>{item.title}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile card */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-3">
        {!isCollapsed && user && (
          <div className="flex items-center gap-3 px-2 py-1 bg-zinc-900/30 border border-white/5 rounded-md">
            {user.imageUrl ? (
              <img src={user.imageUrl} className="h-7 w-7 rounded-full border border-white/10" alt="Avatar" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] font-bold">
                {user.firstName?.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0 font-mono text-[9px]">
              <span className="text-foreground font-semibold block truncate">
                {user.fullName || 'Developer'}
              </span>
              <span className="text-muted-foreground block truncate">
                {organization?.name || 'Personal'}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-2">
          {/* Clerk native SignOutButton */}
          <SignOutButton>
            <button className="text-[10px] font-mono text-muted-foreground hover:text-danger flex items-center gap-1.5 cursor-pointer">
              <span>Sign Out</span>
            </button>
          </SignOutButton>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-muted-foreground hover:text-foreground hidden md:block select-none cursor-pointer"
          >
            <svg
              className={cn('h-4 w-4 transition-transform duration-300', isCollapsed ? 'rotate-180' : '')}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
