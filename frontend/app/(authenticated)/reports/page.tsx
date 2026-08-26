'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { getTestRuns } from '@/services/db';
import { TestRun } from '@/lib/demoData';
import Link from 'next/link';

export default function ReportsPage() {
  const { getToken, orgId } = useAuth();
  const [runs, setRuns] = React.useState<TestRun[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadRuns = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const data = await getTestRuns(token, orgId);
          setRuns(data.filter((r) => r.status === 'passed' || r.status === 'failed'));
        }
      } catch (e) {
        console.error('[Reports Load Error]: Failed loading reports.', e);
      } finally {
        setLoading(false);
      }
    };
    loadRuns();
  }, [getToken, orgId]);

  return (
    <>
      <Stack spacing={24}>
        <Flex justify="between" align="center" wrap={true} className="gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Generated QA Reports</h1>
            <p className="text-xs text-muted-foreground">Comprehensive stability summaries and PDF compliance outputs.</p>
          </div>
          <Link href="/projects">
            <Button variant="accent" size="sm">Run your first test</Button>
          </Link>
        </Flex>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-mono">
            Loading generated reports...
          </div>
        ) : runs.length === 0 ? (
          <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center space-y-4 max-w-md mx-auto my-8">
            <div className="text-xs font-bold text-foreground">No reports compiled yet</div>
            <p className="text-3xs text-muted-foreground leading-relaxed">
              Reports are generated automatically upon completing automated project builds or security verification sweeps.
            </p>
            <div className="pt-2">
              <Link href="/projects">
                <Button variant="outline" size="sm">Run your first test</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/5 rounded-xl bg-zinc-950/40">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase text-muted-foreground">
                  <th className="p-4">Project</th>
                  <th className="p-4">Test Run ID</th>
                  <th className="p-4">Release Score</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-white/5">
                    <td className="p-4 text-foreground font-semibold">{r.projectName || 'Synced Project'}</td>
                    <td className="p-4 text-muted-foreground">{r.id}</td>
                    <td className="p-4 text-accent font-bold">{r.releaseScore}%</td>
                    <td className="p-4 text-muted-foreground">{r.createdAt}</td>
                    <td className="p-4">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        r.status === 'passed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </>
  );
}
