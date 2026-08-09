import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    title: string;
    href?: string;
  }[];
}

export function Breadcrumb({ items, className, ...props }: BreadcrumbProps) {
  return (
    <nav className={cn('flex items-center text-sm font-medium text-muted-foreground', className)} {...props}>
      <ol className="flex items-center space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <React.Fragment key={index}>
              {index > 0 && (
                <span className="text-muted-foreground/40 select-none">/</span>
              )}
              <li>
                {item.href && !isLast ? (
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.title}
                  </Link>
                ) : (
                  <span className="text-foreground font-semibold">{item.title}</span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
