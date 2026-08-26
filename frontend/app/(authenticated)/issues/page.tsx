'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { IssueList } from '@/components/IssueList';
import { Select } from '@/components/Select';
import { getIssues } from '@/services/db';
import { Issue } from '@/lib/demoData';

export default function IssuesPage() {
  const { getToken, orgId } = useAuth();
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filters state
  const [severityFilter, setSeverityFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [projectFilter, setProjectFilter] = React.useState<string>('all');

  React.useEffect(() => {
    const loadIssues = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const data = await getIssues(token, orgId);
          setIssues(data);
        }
      } catch (e) {
        console.error('[Issues Load Error]: Failed loading issues.', e);
      } finally {
        setLoading(false);
      }
    };
    loadIssues();
  }, [getToken, orgId]);

  // Unique projects from issues
  const projectsList = React.useMemo(() => {
    const names = new Set(issues.map((i) => i.projectName || 'Synced Project'));
    return ['all', ...Array.from(names)];
  }, [issues]);

  // Filtered issues
  const filteredIssues = React.useMemo(() => {
    return issues.filter((i) => {
      const matchesSeverity = severityFilter === 'all' || i.severity.toLowerCase() === severityFilter.toLowerCase();
      const matchesStatus = statusFilter === 'all' || (i.status || 'open').toLowerCase() === statusFilter.toLowerCase();
      const matchesProject = projectFilter === 'all' || (i.projectName || 'Synced Project') === projectFilter;
      return matchesSeverity && matchesStatus && matchesProject;
    });
  }, [issues, severityFilter, statusFilter, projectFilter]);

  return (
    <>
      <Stack spacing={24}>
        <Flex justify="between" align="center" wrap={true} className="gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Open Issues</h1>
            <p className="text-xs text-muted-foreground">List of layout overflows, alignment shifts, and functional failures.</p>
          </div>

          {/* Filters */}
          <Flex className="gap-3">
            <Select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              options={[
                { label: 'All Severities', value: 'all' },
                { label: 'Critical', value: 'critical' },
                { label: 'High', value: 'high' },
                { label: 'Medium', value: 'medium' },
                { label: 'Low', value: 'low' },
              ]}
              className="text-xs py-1"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Open', value: 'open' },
                { label: 'Investigating', value: 'investigating' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Ignored', value: 'ignored' },
              ]}
              className="text-xs py-1"
            />
            <Select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              options={projectsList.map((p) => ({
                label: p === 'all' ? 'All Projects' : p,
                value: p,
              }))}
              className="text-xs py-1"
            />
          </Flex>
        </Flex>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-mono">
            Loading issues list...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center space-y-3">
            <div className="text-xs font-bold text-foreground">No issues identified</div>
            <p className="text-3xs text-muted-foreground">Everything looks clean. Stability index score is optimized!</p>
          </div>
        ) : (
          <IssueList issues={filteredIssues} />
        )}
      </Stack>
    </>
  );
}
