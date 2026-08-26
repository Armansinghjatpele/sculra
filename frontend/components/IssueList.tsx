import * as React from 'react';
import { Badge } from './Badge';
import { Issue } from '@/lib/demoData';

export function IssueList({ issues }: { issues: Issue[] }) {
  const severityColors = {
    critical: 'bg-danger/20 text-danger border-danger/30',
    high: 'bg-danger/10 text-danger/80 border-danger/20',
    medium: 'bg-warning/15 text-warning border-warning/30',
    low: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="space-y-3">
      {issues.map((issue) => (
        <div
          key={issue.id}
          className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-card/10 hover:bg-card/25 transition-all duration-150"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className={`text-5xs uppercase tracking-wider font-bold border rounded px-1.5 py-0.5 ${severityColors[issue.severity]}`}>
                {issue.severity}
              </span>
              <span className="text-4xs text-muted-foreground">{issue.projectName}</span>
            </div>
            <p className="text-xs font-semibold text-foreground truncate mt-1">
              {issue.title}
            </p>
          </div>
          <span className="text-4xs text-muted-foreground shrink-0 ml-4">{issue.detectedAt}</span>
        </div>
      ))}
    </div>
  );
}
