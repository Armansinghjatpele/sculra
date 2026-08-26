import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SeverityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export function SeverityBadge({ severity, className, ...props }: SeverityBadgeProps) {
  const severityColors = {
    critical: 'bg-danger/20 text-danger border-danger/30',
    high: 'bg-danger/10 text-danger/80 border-danger/20',
    medium: 'bg-warning/15 text-warning border-warning/30',
    low: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center text-5xs uppercase tracking-wider font-bold border rounded px-1.5 py-0.5',
        severityColors[severity],
        className
      )}
      {...props}
    >
      {severity}
    </span>
  );
}
