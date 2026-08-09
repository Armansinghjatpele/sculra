import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-danger/20 p-8 text-center bg-danger/5 backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {/* Danger Icon */}
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-danger/10 border border-danger/25 text-danger mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      {/* Message */}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-md">{message}</p>

      {/* Action Retry */}
      {onRetry && (
        <div className="mt-6">
          <Button variant="outline" size="sm" onClick={onRetry} className="border-danger/35 hover:bg-danger/10 text-foreground">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
