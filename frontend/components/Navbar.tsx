'use client';

import * as React from 'react';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton, OrganizationSwitcher } from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {}

export function Navbar({ className, ...props }: NavbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border bg-background/60 backdrop-blur-md',
        className
      )}
      {...props}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <svg
              className="h-5 w-5 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="font-bold tracking-tight text-foreground sm:inline-block">
              Sculra
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden gap-6 md:flex">
            <Link
              href="/features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/enterprise"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Enterprise
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
          </nav>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          <SignedOut>
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button variant="accent" size="sm">
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
                    rootBox: 'text-xs text-foreground bg-zinc-900 border border-white/8 rounded p-1',
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
