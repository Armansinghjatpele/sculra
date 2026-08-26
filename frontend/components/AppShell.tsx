'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { CommandMenu } from './CommandMenu';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

// Primary & Secondary menu items for mobile drawing drawer
const mobileNav = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Projects', href: '/projects' },
  { title: 'Test Runs', href: '/test-runs' },
  { title: 'Issues', href: '/issues' },
  { title: 'Reports', href: '/reports' },
  { title: 'Team', href: '/team' },
  { title: 'Settings', href: '/settings' },
];

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isCmdOpen, setIsCmdOpen] = React.useState(false);

  // Keyboard shortcut listener for Cmd/Ctrl + K
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const commandItems = [
    {
      category: 'Navigation',
      links: [
        { title: 'Go to Dashboard', href: '/dashboard' },
        { title: 'Go to Projects', href: '/projects' },
        { title: 'Go to Test Runs', href: '/test-runs' },
        { title: 'Go to Issues', href: '/issues' },
        { title: 'Go to Reports', href: '/reports' },
        { title: 'Go to Team', href: '/team' },
        { title: 'Go to Settings', href: '/settings' },
      ],
    },
    {
      category: 'Actions',
      links: [
        { title: 'Create Project', href: '/projects' },
        { title: 'Start Test', href: '/dashboard' },
        { title: 'Open Documentation', href: '/docs' },
      ],
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground select-none">
      {/* 1. Sidebar Panel (Desktop/Collapsible) */}
      <AppSidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      {/* 2. Main content container */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Header */}
        <AppHeader setIsMobileOpen={setIsMobileOpen} setIsCmdOpen={setIsCmdOpen} />

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-zinc-950/10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 3. Command Menu Overlay */}
      <CommandMenu isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} items={commandItems} />

      {/* 4. Mobile Navigation Overlay / Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <nav className="relative flex flex-col w-64 max-w-xs p-4 bg-zinc-950 border-r border-border h-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <span className="font-bold tracking-tight text-xs uppercase text-foreground">Sculra</span>
              <button onClick={() => setIsMobileOpen(false)} className="text-muted-foreground hover:text-foreground text-sm font-bold">×</button>
            </div>
            <WorkspaceSwitcher />
            <div className="flex-grow space-y-1 overflow-y-auto">
              {mobileNav.map((item, idx) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      'flex items-center rounded px-3 py-2 text-xs font-semibold transition-colors',
                      isActive ? 'bg-zinc-900 text-accent font-bold' : 'text-muted-foreground hover:bg-zinc-900/50 hover:text-foreground'
                    )}
                  >
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
