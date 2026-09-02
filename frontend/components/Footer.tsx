import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {}

export function Footer({ className, ...props }: FooterProps) {
  return (
    <footer
      className={cn('border-t border-border bg-background py-8 text-muted-foreground', className)}
      {...props}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center space-x-2">
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
            <span className="text-sm font-semibold tracking-tight text-foreground">Sculra</span>
          </div>

          <p className="text-center text-xs leading-5">
            &copy; {new Date().getFullYear()} Sculra, Inc. All rights reserved.
          </p>

          <div className="flex gap-4 text-xs font-medium">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/status" className="hover:text-foreground">
              System Status
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

