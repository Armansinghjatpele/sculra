'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Breadcrumb } from './Breadcrumb';

interface AppHeaderProps {
  setIsMobileOpen: (open: boolean) => void;
  setIsCmdOpen: (open: boolean) => void;
}

export function AppHeader({ setIsMobileOpen, setIsCmdOpen }: AppHeaderProps) {
  const pathname = usePathname();

  // Resolve breadcrumbs list dynamically
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    { title: 'Sculra', href: '/dashboard' },
    ...pathSegments.map((seg, idx) => {
      const href = '/' + pathSegments.slice(0, idx + 1).join('/');
      const title = seg.charAt(0).toUpperCase() + seg.slice(1).replace('-', ' ');
      return { title, href };
    }),
  ];

  return (
    <header className="h-14 border-b border-border bg-zinc-950/20 flex items-center justify-between px-4 sm:px-6">
      {/* Left: mobile toggle & breadcrumbs */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Right: global search trigger and notification bell */}
      <div className="flex items-center space-x-3">
        {/* Cmd K search bar shortcut button */}
        <button
          onClick={() => setIsCmdOpen(true)}
          className="hidden sm:flex items-center space-x-2 text-[10px] font-mono border border-white/5 bg-zinc-900/40 rounded px-2.5 py-1 text-muted-foreground hover:text-foreground hover:border-white/10 transition-all cursor-pointer"
        >
          <span>Search console...</span>
          <kbd className="border border-white/10 bg-zinc-800 px-1 py-0.5 rounded text-[8px]">⌘K</kbd>
        </button>

        <Link href="/notifications" className="relative p-1 text-muted-foreground hover:text-foreground cursor-pointer">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
