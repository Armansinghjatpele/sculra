'use client';

import * as React from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {}

export function Navbar({ className, ...props }: NavbarProps) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="sticky top-4 sm:top-5 z-50 w-full px-3 sm:px-6 pointer-events-none flex justify-center">
      <div
        className={cn(
          'pointer-events-auto mx-auto w-full max-w-5xl rounded-full border transition-all duration-300 flex h-14 items-center justify-between px-4 sm:px-6',
          scrolled
            ? 'bg-white/95 backdrop-blur-md border-zinc-300 shadow-lg'
            : 'bg-zinc-50/90 backdrop-blur-sm border-zinc-200/90 shadow-md',
          className
        )}
        {...props}
      >
        {/* Left: Logo + Wordmark */}
        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="h-7 w-7 rounded-lg bg-zinc-950 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <svg
                className="h-4 w-4 text-cyan-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="font-black tracking-tight text-zinc-950 text-lg sm:text-xl font-sans">
              Sculra
            </span>
          </Link>

          {/* Centered / Left-of-center Nav Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8">
            <Link
              href="/features"
              className="text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 font-sans tracking-tight"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 font-sans tracking-tight"
            >
              Pricing
            </Link>
            <Link
              href="/enterprise"
              className="text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 font-sans tracking-tight"
            >
              Enterprise
            </Link>
            <Link
              href="/docs"
              className="text-sm font-semibold text-zinc-600 transition-colors hover:text-zinc-950 font-sans tracking-tight"
            >
              Docs
            </Link>
          </nav>
        </div>

        {/* Right-side action group: two-tier button pair mirroring MCP Market */}
        <div className="flex items-center gap-2 sm:gap-3">
          <SignedOut>
            <Link href="/sign-in">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-bold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-200/60 rounded-full px-3.5 py-1.5 font-sans"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button
                variant="default"
                size="sm"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-zinc-950 text-white hover:bg-zinc-800 rounded-full px-4 py-1.5 shadow-xs font-sans transition-transform hover:scale-105"
              >
                <svg className="h-3 w-3 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                <span>Start Testing Free</span>
              </Button>
            </Link>
          </SignedOut>

          <SignedIn>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-semibold text-zinc-600 hover:text-zinc-950 transition-colors font-sans"
              >
                Dashboard
              </Link>
              <OrganizationSwitcher
                afterCreateOrganizationUrl="/dashboard"
                afterLeaveOrganizationUrl="/"
                afterSelectOrganizationUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: 'text-xs text-zinc-900 bg-zinc-100 border border-zinc-200 rounded-full px-2.5 py-1 shadow-xs',
                  },
                }}
              />
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
