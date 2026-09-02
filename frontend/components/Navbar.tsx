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
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b transition-all duration-200',
        scrolled
          ? 'border-border/80 bg-background/80 backdrop-blur-md shadow-xs'
          : 'border-transparent bg-background/60 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded-md bg-zinc-950 flex items-center justify-center text-white shadow-xs">
              <svg
                className="h-3.5 w-3.5 text-cyan-400"
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
            <span className="font-extrabold tracking-tight text-foreground sm:inline-block text-base">
              Sculra
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden gap-6 md:flex">
            <Link
              href="/features"
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/enterprise"
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Enterprise
            </Link>
            <Link
              href="/docs"
              className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
          </nav>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <SignedOut>
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="text-xs font-semibold">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="default" size="sm" className="text-xs font-semibold bg-zinc-950 text-white hover:bg-zinc-800 shadow-xs">
                Get Started
              </Button>
            </Link>
          </SignedOut>

          <SignedIn>
            <div className="flex items-center gap-3.5">
              <Link href="/dashboard" className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <OrganizationSwitcher
                afterCreateOrganizationUrl="/dashboard"
                afterLeaveOrganizationUrl="/"
                afterSelectOrganizationUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: 'text-xs text-foreground bg-zinc-100 border border-zinc-200 rounded p-1 shadow-xs',
                  }
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
