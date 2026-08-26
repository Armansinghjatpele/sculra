'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { TestRunTable } from '@/components/TestRunTable';
import { Select } from '@/components/Select';
import { getTestRuns } from '@/services/db';
import { TestRun } from '@/lib/demoData';

export default function TestRunsPage() {
  const { getToken, orgId } = useAuth();
  const [runs, setRuns] = React.useState<TestRun[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Filter states
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [projectFilter, setProjectFilter] = React.useState<string>('all');

  React.useEffect(() => {
    const loadRuns = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const data = await getTestRuns(token, orgId);
          setRuns(data);
        }
      } catch (e) {
        console.error('[TestRuns Load Error]: Failed loading test runs.', e);
      } finally {
        setLoading(false);
      }
    };
    loadRuns();
  }, [getToken, orgId]);

  // Unique projects from runs
  const projectsList = React.useMemo(() => {
    const names = new Set(runs.map((r) => r.projectName || 'Synced Project'));
    return ['all', ...Array.from(names)];
  }, [runs]);

  // Filtered runs
  const filteredRuns = React.useMemo(() => {
    return runs.filter((r) => {
      const matchesStatus = statusFilter === 'all' || r.status.toLowerCase() === statusFilter.toLowerCase();
      const matchesProject = projectFilter === 'all' || (r.projectName || 'Synced Project') === projectFilter;
      return matchesStatus && matchesProject;
    });
  }, [runs, statusFilter, projectFilter]);

  return (
    <AppShell>
      <Stack spacing={24}>
        <Flex justify="between" align="center" wrap={true} className="gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Test Runs</h1>
            <p className="text-xs text-muted-foreground">Historical list of AI agent testing execution runs.</p>
          </div>

          {/* Filter options */}
          <Flex className="gap-3">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Queued', value: 'queued' },
                { label: 'Running', value: 'running' },
                { label: 'Passed', value: 'passed' },
                { label: 'Failed', value: 'failed' },
                { label: 'Cancelled', value: 'cancelled' },
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
            Loading test runs history...
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center space-y-3">
            <div className="text-xs font-bold text-foreground">No test runs found</div>
            <p className="text-3xs text-muted-foreground">Try adjusting your filters or connect a new project target.</p>
          </div>
        ) : (
          <TestRunTable runs={filteredRuns} />
        )}
      </Stack>
    </AppShell>
  );
}
