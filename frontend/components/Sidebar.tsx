import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  items: {
    title: string;
    href: string;
    icon: React.ReactNode;
  }[];
}

export function Sidebar({ items, className, ...props }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'flex h-screen w-64 flex-col border-r border-border bg-card/10 p-4',
        className
      )}
      {...props}
    >
      {/* Brand */}
      <div className="mb-8 flex items-center space-x-2 px-2">
        <span className="h-6 w-6 rounded bg-primary flex items-center justify-center font-bold text-white text-xs">
          QP
        </span>
        <span className="font-bold tracking-tight text-foreground">Sculra</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {items.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={index}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-all',
                isActive
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <span className="h-4 w-4 flex-shrink-0 text-current">{item.icon}</span>
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Profile Shortcut Placeholder */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center space-x-3 px-2">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
            U
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-xs font-medium text-foreground">Developer User</p>
            <p className="truncate text-3xs text-muted-foreground">dev@Sculra.io</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

