import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'passed' | 'running' | 'failed' | 'needs_review';
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const statusColors = {
    passed: 'success',
    running: 'accent',
    failed: 'danger',
    needs_review: 'warning',
  } as const;

  return (
    <Badge
      variant={statusColors[status]}
      className={cn('text-5xs uppercase tracking-wider py-0.5 px-2 select-none', className)}
      {...props}
    >
      {status.replace('_', ' ')}
    </Badge>
  );
}
