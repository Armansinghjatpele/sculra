import * as React from 'react';
import { cn } from '@/lib/utils';
import { Flex } from './LayoutPrimitives';

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action, className, ...props }: PageHeaderProps) {
  return (
    <Flex justify="between" align="center" wrap={true} className={cn('gap-4 border-b border-border/30 pb-4', className)} {...props}>
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </Flex>
  );
}
