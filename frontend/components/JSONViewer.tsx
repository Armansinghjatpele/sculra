'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface JSONViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any> | Array<any>;
}

export function JSONViewer({ data, className, ...props }: JSONViewerProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const formattedJson = JSON.stringify(data, null, 2);

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-black/40 p-4 font-mono text-xs text-foreground',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2 select-none">
        <span className="text-4xs font-semibold text-muted-foreground uppercase tracking-widest">
          JSON Payload
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-4xs text-muted-foreground hover:text-foreground transition-all cursor-pointer font-medium"
        >
          {collapsed ? 'Expand ({...})' : 'Collapse (-)'}
        </button>
      </div>

      {!collapsed ? (
        <pre className="overflow-x-auto whitespace-pre-wrap leading-relaxed">
          <code>{formattedJson}</code>
        </pre>
      ) : (
        <span className="text-muted-foreground select-none">
          {Array.isArray(data) ? `[ Array(${data.length}) ]` : '{ Object }'}
        </span>
      )}
    </div>
  );
}
