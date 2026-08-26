'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { Breadcrumb } from './Breadcrumb';
import { CommandMenu } from './CommandMenu';

// Main navigation items
const primaryNav = [
  { title: 'Dashboard', href: '/dashboard', icon: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { title: 'Projects', href: '/projects', icon: 'M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18l-8-4-8 4z' },
  { title: 'Test Runs', href: '/test-runs', icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 6v6l4 2' },
  { title: 'Reports', href: '/reports', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6' },
  { title: 'Release Readiness', href: '/release-readiness', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  { title: 'AI Insights', href: '/ai-insights', icon: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
];

const secondaryNav = [
  { title: 'Notifications', href: '/notifications', icon: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0' },
  { title: 'Settings', href: '/settings', icon: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' },
  { title: 'API Keys', href: '/api-keys', icon: 'm21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3' },
  { title: 'Billing', href: '/billing', icon: 'M2 5h20v14H2z M2 10h20' },
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

  // Breadcrumbs title resolution
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    { title: 'Sculra', href: '/dashboard' },
    ...pathSegments.map((seg, idx) => {
      const href = '/' + pathSegments.slice(0, idx + 1).join('/');
      const title = seg.charAt(0).toUpperCase() + seg.slice(1).replace('-', ' ');
      return { title, href };
    }),
  ];

  const commandItems = [
    {
      category: 'Navigation',
      links: [
        { title: 'Go to Dashboard', href: '/dashboard' },
        { title: 'Go to Projects', href: '/projects' },
        { title: 'Go to Test Runs', href: '/test-runs' },
        { title: 'Go to Reports', href: '/reports' },
        { title: 'Go to Release Readiness', href: '/release-readiness' },
        { title: 'Go to AI Insights', href: '/ai-insights' },
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
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-border bg-card/15 backdrop-blur-sm transition-all duration-300 ease-in-out',
          isCollapsed ? 'w-16 p-2.5' : 'w-64 p-4'
        )}
      >
        {/* Workspace Swticher / Brand */}
        <div className="mb-6 flex flex-col gap-4">
          <Link href="/" className="flex items-center space-x-2.5 px-2 select-none self-start">
            <svg
              className="h-5 w-5 text-accent shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {!isCollapsed && (
              <span className="font-bold tracking-tight text-foreground text-sm uppercase">Sculra</span>
            )}
          </Link>

          {!isCollapsed && <WorkspaceSwitcher />}
        </div>

        {/* Primary Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {primaryNav.map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  'flex items-center rounded-md py-2 px-3 text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  isCollapsed ? 'justify-center px-0' : 'space-x-3'
                )}
              >
                <svg
                  className="h-4 w-4 shrink-0 text-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            );
          })}

          <div className="py-2">
            <hr className="border-border/30" />
          </div>

          {/* Secondary settings items */}
          {secondaryNav.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={index}
                href={item.href}
                className={cn(
                  'flex items-center rounded-md py-2 px-3 text-xs font-semibold transition-all duration-150',
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  isCollapsed ? 'justify-center px-0' : 'space-x-3'
                )}
              >
                <svg
                  className="h-4 w-4 shrink-0 text-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
                {!isCollapsed && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer Area */}
        <div className="border-t border-border/30 pt-4 flex flex-col gap-4">
          {!isCollapsed && (
            <Link href="/docs" className="text-3xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-2 px-2.5">
              <span>❓ Help & Support</span>
            </Link>
          )}

          <div className="flex items-center justify-between px-2">
            <UserButton afterSignOutUrl="/" />
            
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

      {/* 2. Main content container */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card/5 flex items-center justify-between px-4 sm:px-6">
          {/* Left: Breadcrumbs & mobile triggers */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="md:hidden text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Breadcrumb items={breadcrumbItems} />
          </div>

          {/* Right: Search trigger & notifications */}
          <div className="flex items-center space-x-3">
            {/* Search command shortcut block */}
            <button
              onClick={() => setIsCmdOpen(true)}
              className="hidden sm:flex items-center space-x-2 text-3xs border border-border bg-zinc-900/40 rounded px-2.5 py-1 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            >
              <span>Search console...</span>
              <kbd className="border border-border/60 bg-muted px-1.5 py-0.5 rounded text-4xs">⌘K</kbd>
            </button>

            <Link href="/notifications" className="relative p-1 text-muted-foreground hover:text-foreground cursor-pointer">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-background max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 3. Command Menu Overlay */}
      <CommandMenu isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} items={commandItems} />

      {/* 4. Mobile Navigation Overlay / Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <nav className="relative flex flex-col w-64 max-w-xs p-4 bg-card border-r border-border h-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/30">
              <span className="font-bold tracking-tight text-sm uppercase text-foreground">Sculra Navigation</span>
              <button onClick={() => setIsMobileOpen(false)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>
            <WorkspaceSwitcher />
            <div className="flex-1 space-y-1 overflow-y-auto">
              {primaryNav.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center space-x-3 rounded px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>{item.title}</span>
                </Link>
              ))}
              <hr className="border-border/30 my-2" />
              {secondaryNav.map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center space-x-3 rounded px-2.5 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  <span>{item.title}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
