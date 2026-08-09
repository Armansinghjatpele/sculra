import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data?: { label: string; value: number }[];
  height?: number;
}

export function Chart({ data = [], height = 180, className, ...props }: ChartProps) {
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 100;

  return (
    <div
      className={cn(
        'relative flex flex-col justify-end rounded-lg border border-border bg-card/40 p-4 backdrop-blur-sm',
        className
      )}
      style={{ height }}
      {...props}
    >
      <div className="flex h-full w-full items-end justify-between space-x-2">
        {data.map((item, index) => {
          const percentage = maxValue > 0 ? (item.value / maxValue) * 80 : 0; // capped at 80% height for padding
          return (
            <div key={index} className="group relative flex flex-1 flex-col items-center">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden rounded bg-popover px-2 py-1 text-2xs text-foreground shadow border border-border group-hover:block whitespace-nowrap">
                {item.value}
              </div>

              {/* Bar */}
              <div
                style={{ height: `${percentage}%` }}
                className="w-full rounded-t bg-primary transition-all duration-300 hover:bg-accent cursor-pointer shadow-glass"
              />

              {/* Label */}
              <span className="mt-2 text-3xs text-muted-foreground uppercase tracking-wider truncate w-full text-center">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
