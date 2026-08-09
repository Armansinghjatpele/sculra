import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  title: string;
  description?: string;
  timestamp: string;
  status?: 'passed' | 'failed' | 'pending' | 'running';
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TimelineItem[];
}

export function Timeline({ items, className, ...props }: TimelineProps) {
  const statusColors = {
    passed: 'bg-success border-success/20',
    failed: 'bg-danger border-danger/20',
    pending: 'bg-muted border-border',
    running: 'bg-primary border-primary/20 animate-pulse',
  };

  return (
    <div className={cn('relative pl-6 border-l border-border space-y-8', className)} {...props}>
      {items.map((item, index) => (
        <div key={index} className="relative group">
          {/* Indicator Bullet */}
          <span
            className={cn(
              'absolute -left-[31px] top-1.5 flex h-4.5 w-4.5 shrink-0 rounded-full border items-center justify-center shadow-sm',
              item.status ? statusColors[item.status] : 'bg-muted border-border'
            )}
          />

          {/* Details */}
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
              <time className="text-4xs text-muted-foreground">{item.timestamp}</time>
            </div>
            {item.description && (
              <p className="text-xs text-muted-foreground">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
