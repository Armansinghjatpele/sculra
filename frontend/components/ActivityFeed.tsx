import * as React from 'react';
import { cn } from '@/lib/utils';

export interface Activity {
  id: string;
  user: { name: string; avatarUrl?: string };
  action: string;
  target?: string;
  timestamp: string;
}

export interface ActivityFeedProps extends React.HTMLAttributes<HTMLDivElement> {
  activities: Activity[];
}

export function ActivityFeed({ activities, className, ...props }: ActivityFeedProps) {
  return (
    <div className={cn('flow-root', className)} {...props}>
      <ul role="list" className="-mb-8">
        {activities.map((activity, idx) => {
          const isLast = idx === activities.length - 1;
          return (
            <li key={activity.id} className="relative pb-8">
              {!isLast && (
                <span
                  className="absolute left-4.5 top-4.5 -ml-px h-full w-[1px] bg-border"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                {/* User Avatar Initial */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted border border-border text-xs font-semibold text-foreground uppercase select-none">
                  {activity.user.name.substring(0, 1)}
                </div>

                <div className="flex-1 min-w-0 pt-1.5">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{activity.user.name}</span>{' '}
                    {activity.action}{' '}
                    {activity.target && (
                      <span className="font-medium text-foreground">{activity.target}</span>
                    )}
                  </p>
                  <time className="text-4xs text-muted-foreground block mt-0.5">
                    {activity.timestamp}
                  </time>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
