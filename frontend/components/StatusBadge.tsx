import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: string;
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const normalized = (status || '').toLowerCase();
  let variant: 'success' | 'accent' | 'danger' | 'warning' | 'default' = 'default';

  if (normalized === 'passed' || normalized === 'active') {
    variant = 'success';
  } else if (normalized === 'running') {
    variant = 'accent';
  } else if (normalized === 'failed') {
    variant = 'danger';
  } else if (normalized === 'needs_review' || normalized === 'queued') {
    variant = 'warning';
  } else if (normalized === 'cancelled' || normalized === 'archived' || normalized === 'paused') {
    variant = 'default';
  }

  return (
    <Badge
      variant={variant}
      className={cn('text-5xs uppercase tracking-wider py-0.5 px-2 select-none font-mono', className)}
      {...props}
    >
      {normalized.replace('_', ' ')}
    </Badge>
  );
}
