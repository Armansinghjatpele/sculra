import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  actionText,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center bg-card/10 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {/* Icon Wrapper */}
      {icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground mb-4">
          {icon}
        </div>
      )}

      {/* Message */}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">{description}</p>

      {/* Button Action */}
      {actionText && onAction && (
        <div className="mt-6">
          <Button variant="accent" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
