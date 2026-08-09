import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallbackText?: string;
}

export function Avatar({ src, fallbackText = '?', className, ...props }: AvatarProps) {
  const [error, setError] = React.useState(!src);

  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted border border-border items-center justify-center text-sm font-semibold text-foreground',
        className
      )}
      {...props}
    >
      {!error && src ? (
        <img
          src={src}
          alt="Avatar image"
          onError={() => setError(true)}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className="uppercase">{fallbackText.substring(0, 2)}</span>
      )}
    </div>
  );
}
