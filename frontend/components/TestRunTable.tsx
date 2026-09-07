import * as React from 'react';
import Link from 'next/link';
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
            <TableRow key={run.id} className="hover:bg-muted/40 transition-colors group cursor-pointer">
              <TableCell className="text-xs font-semibold text-foreground">
                <Link
                  href={`/test-runs/${run.id}`}
                  className="hover:text-accent transition-colors flex items-center gap-1.5"
                >
                  <span>{run.projectName}</span>
                  <span className="opacity-0 group-hover:opacity-100 text-accent text-3xs font-mono">→</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/test-runs/${run.id}`}>
                  <StatusBadge status={run.status} />
                </Link>
              </TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground">{run.issuesCount} issues</TableCell>
              <TableCell className="text-xs font-bold text-foreground">
                {run.releaseScore !== null && run.releaseScore !== undefined ? `${run.releaseScore}%` : '--'}
              </TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground">
                {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '--'}
              </TableCell>
              <TableCell className="text-xs font-medium text-muted-foreground">{run.createdAt}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
