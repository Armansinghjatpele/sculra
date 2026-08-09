import * as React from 'react';
import Link from 'next/link';
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
            <span className="h-6 w-6 rounded bg-primary flex items-center justify-center font-bold text-white text-xs">
              QP
            </span>
            <span className="hidden font-bold tracking-tight text-foreground sm:inline-block">
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
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button variant="accent" size="sm">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

