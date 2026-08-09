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
            <span className="h-5 w-5 rounded bg-muted flex items-center justify-center font-bold text-foreground text-3xs">
              QP
            </span>
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

