import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children, className, ...props }: TooltipProps) {
  return (
    <div className="group relative inline-block">
      {children}
      <div
        className={cn(
          'absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 scale-90 rounded bg-popover border border-border px-2 py-1 text-4xs font-medium text-foreground opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100 pointer-events-none select-none whitespace-nowrap',
          className
        )}
        {...props}
      >
        {content}
      </div>
    </div>
  );
}
