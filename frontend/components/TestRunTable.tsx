import * as React from 'react';
import { StatusBadge } from './StatusBadge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './Table';
import { TestRun } from '@/lib/demoData';

export function TestRunTable({ runs }: { runs: TestRun[] }) {
  return (
    <div className="rounded-md border border-border bg-card/10 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-4xs uppercase tracking-wider">Project</TableHead>
            <TableHead className="text-4xs uppercase tracking-wider">Status</TableHead>
            <TableHead className="text-4xs uppercase tracking-wider">Issues</TableHead>
            <TableHead className="text-4xs uppercase tracking-wider">Score</TableHead>
            <TableHead className="text-4xs uppercase tracking-wider">Duration</TableHead>
            <TableHead className="text-4xs uppercase tracking-wider">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id} className="hover:bg-muted/40 transition-colors">
              <TableCell className="text-xs font-semibold text-foreground">{run.projectName}</TableCell>
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground">{run.issuesCount} issues</TableCell>
              <TableCell className="text-xs font-bold text-foreground">{run.releaseScore}%</TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground">{(run.durationMs / 1000).toFixed(1)}s</TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground">{run.createdAt}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
