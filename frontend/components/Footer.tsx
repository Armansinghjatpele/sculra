import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface FooterProps extends React.HTMLAttributes<HTMLElement> {}

export function Footer({ className, ...props }: FooterProps) {
  return (
    <footer
      className={cn('border-t border-border bg-neutral-100/60 py-12 text-muted-foreground', className)}
      {...props}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center space-x-2.5">
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
            <span className="text-sm font-extrabold tracking-tight text-foreground">Sculra</span>
          </div>

          <p className="text-center text-xs leading-5">
            &copy; {new Date().getFullYear()} Sculra, Inc. All rights reserved.
          </p>

          <div className="flex gap-6 text-xs font-semibold">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms of Service
            </Link>
            <Link href="/status" className="transition-colors hover:text-foreground">
              System Status
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
