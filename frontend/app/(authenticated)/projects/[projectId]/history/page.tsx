'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { getProject, getTestRuns, getProjectHistorySignals } from '@/services/db';
import { Project, TestRun, QASignalRecord } from '@/lib/demoData';
import {
  formatScoreDelta,
  getScoreDeltaColor,
  getTrendBadge,
  getFindingHistoricalBadge,
  getStabilityBadge,
} from '@/lib/historyUtils';

interface ProjectHistoryPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectHistoryPage({ params }: ProjectHistoryPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { getToken, orgId } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [testRuns, setTestRuns] = React.useState<TestRun[]>([]);
  const [signals, setSignals] = React.useState<QASignalRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const [proj, runs, sigs] = await Promise.all([
            getProject(token, projectId),
            getTestRuns(token, orgId),
            getProjectHistorySignals(token, projectId),
          ]);
          setProject(proj);
          setTestRuns(runs.filter((r) => r.projectId === projectId));
          setSignals(sigs || []);
        }
      } catch (e) {
        console.error('[ProjectHistoryPage Load Error]:', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [getToken, orgId, projectId]);

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-muted-foreground font-mono">
        <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        Loading historical QA memory & regression intelligence...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-16 text-center max-w-sm mx-auto space-y-4">
        <h1 className="text-lg font-bold text-foreground">Project Not Found</h1>
        <p className="text-xs text-muted-foreground">The requested project ID does not exist in your workspace.</p>
        <Link href="/projects">
          <Button variant="accent" size="sm">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  // Chronological test runs
  const sortedRuns = [...testRuns].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Derive historical metrics
  const regressions = signals.filter(
    (s) =>
      s.signalType === 'NEW_REGRESSION' ||
      s.signalType === 'PERFORMANCE_REGRESSION' ||
      s.signalType === 'ACCESSIBILITY_REGRESSION' ||
      s.signalType === 'SECURITY_REGRESSION' ||
      s.signalType === 'API_REGRESSION' ||
      s.signalType === 'VISUAL_REGRESSION'
  );
  const recoveries = signals.filter((s) => s.signalType === 'RECOVERED_DEFECT');
  const recurrences = signals.filter((s) => s.signalType === 'RECURRING_DEFECT');
  const stabilitySignals = signals.filter(
    (s) =>
      s.signalType === 'STABLE_PASS' ||
      s.signalType === 'STABLE_FAILURE' ||
      s.signalType === 'INTERMITTENT_TARGET'
  );
  const flakyTargets = signals.filter((s) => {
    const flake = s.metadata?.flakeRate || 0;
    return s.signalType === 'INTERMITTENT_TARGET' || flake > 0.2;
  });

  // Calculate overall trend
  let overallTrend: 'IMPROVING' | 'DEGRADING' | 'STABLE' | 'VOLATILE' | 'INSUFFICIENT_DATA' = 'INSUFFICIENT_DATA';
  if (sortedRuns.length >= 2) {
    if (regressions.length === 0 && recoveries.length > 0) {
      overallTrend = 'IMPROVING';
    } else if (regressions.length > recoveries.length) {
      overallTrend = 'DEGRADING';
    } else if (flakyTargets.length > 2) {
      overallTrend = 'VOLATILE';
    } else {
      overallTrend = 'STABLE';
    }
  }

  const trendBadge = getTrendBadge(overallTrend);

  return (
    <Stack spacing={24}>
      {/* Header */}
      <PageHeader
        title={`QA History & Stability Monitor: ${project.name}`}
        description={`Cross-run regression intelligence, flakiness detection, and historical memory for ${project.url || 'configured URL'}`}
        action={
          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">Back to Project</Button>
            </Link>
          </div>
        }
      />

      {/* Summary Scorecards Grid */}
      <Grid cols={1} colsSm={2} colsMd={3} colsLg={6} gap={16}>
        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Overall QA Trend</CardDescription>
            <CardTitle className="text-lg font-extrabold mt-1">
              <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded border ${trendBadge.bg} ${trendBadge.border} ${trendBadge.text}`}>
                {trendBadge.label}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            {sortedRuns.length} total test runs evaluated
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Active Regressions</CardDescription>
            <CardTitle className={`text-lg font-extrabold mt-1 font-mono ${regressions.length > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {regressions.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            {regressions.length > 0 ? 'Requires attention' : 'Zero active regressions'}
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Verified Recoveries</CardDescription>
            <CardTitle className="text-lg font-extrabold mt-1 font-mono text-emerald-400">
              {recoveries.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            Retested & confirmed fixed
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Recurring Defects</CardDescription>
            <CardTitle className={`text-lg font-extrabold mt-1 font-mono ${recurrences.length > 0 ? 'text-amber-400' : 'text-foreground'}`}>
              {recurrences.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            Persisting across runs
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Flaky Targets</CardDescription>
            <CardTitle className={`text-lg font-extrabold mt-1 font-mono ${flakyTargets.length > 0 ? 'text-purple-400' : 'text-emerald-400'}`}>
              {flakyTargets.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            Intermittent test targets
          </CardContent>
        </Card>
      </Grid>

      {/* Test Runs Evolution Timeline */}
      <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4 font-mono">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="text-accent">●</span> Execution History & Evolution Timeline
            </h3>
            <p className="text-3xs text-muted-foreground mt-0.5">
              Chronological sequence of test executions evaluated for this project.
            </p>
          </div>
          <span className="text-3xs text-muted-foreground">
            {sortedRuns.length} Runs Recorded
          </span>
        </div>

        {sortedRuns.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground bg-zinc-950/40 rounded-xl border border-white/5">
            No test runs recorded for this project yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-4xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 px-3">Run ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-3xs">
                {sortedRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-zinc-950/40">
                    <td className="py-2.5 px-3 font-semibold">
                      <Link
                        href={`/test-runs/${run.id}`}
                        className="text-accent hover:underline flex items-center gap-1.5"
                      >
                        <span>{run.id.slice(0, 8)}...</span>
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {run.createdAt}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link href={`/test-runs/${run.id}`}>
                        <Button variant="outline" size="sm" className="text-4xs py-1 px-2">
                          Inspect Run →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Flaky Target Watchlist */}
      {flakyTargets.length > 0 && (
        <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span className="text-purple-400">●</span> Flaky Target Watchlist
              </h3>
              <p className="text-3xs text-muted-foreground mt-0.5">
                Targets exhibiting intermittent pass/fail behaviors across runs.
              </p>
            </div>
            <span className="text-3xs font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {flakyTargets.length} Intermittent
            </span>
          </div>

          <div className="space-y-2">
            {flakyTargets.map((ft, fIdx) => (
              <div
                key={ft.id || fIdx}
                className="p-3 rounded-xl bg-zinc-950/60 border border-purple-500/20 text-xs flex flex-wrap items-center justify-between gap-3"
              >
                <div className="truncate max-w-md">
                  <span className="text-purple-400 font-bold mr-2">[FLAKY]</span>
                  <span className="text-foreground font-semibold">{ft.targetIdentifier}</span>
                </div>
                <div className="flex items-center gap-3 text-3xs">
                  <span className="text-muted-foreground">
                    Flake Rate: <span className="text-amber-400 font-bold">{Math.round((ft.metadata?.flakeRate || 0.5) * 100)}%</span>
                  </span>
                  <span className="text-muted-foreground">
                    Consecutive: <span className="text-foreground">{ft.consecutiveCount || 1}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Signals Feed */}
      {signals.length > 0 && (
        <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="text-accent">●</span> Historical QA Memory Signals ({signals.length})
            </h3>
            <span className="text-4xs text-muted-foreground uppercase">RLS Protected Database Log</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {signals.map((sig, sIdx) => {
              const badge = getFindingHistoricalBadge(sig.signalType);
              return (
                <div
                  key={sig.id || sIdx}
                  className="p-3 rounded-xl bg-zinc-950/50 border border-white/5 text-xs flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 truncate max-w-lg">
                    <span className={`text-4xs font-bold px-1.5 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                      {badge.label}
                    </span>
                    <span className="text-foreground font-semibold truncate">{sig.targetIdentifier}</span>
                  </div>
                  <div className="flex items-center gap-3 text-3xs text-muted-foreground">
                    <span>{sig.targetType}</span>
                    {sig.createdAt && <span>{sig.createdAt}</span>}
                    {sig.testRunId && (
                      <Link
                        href={`/test-runs/${sig.testRunId}`}
                        className="text-accent hover:underline"
                      >
                        Run →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Stack>
  );
}
