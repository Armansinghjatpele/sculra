'use client';

import * as React from 'react';
import { useUser, useAuth } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { ReleaseScoreWidget, StatisticsWidget, BugCounterWidget, AIInsightsWidget } from '@/components/DashboardWidgets';
import { TestRunTable } from '@/components/TestRunTable';
import { IssueList } from '@/components/IssueList';
import { getProjects, getTestRuns, getIssues, getAIInsights } from '@/services/db';
import { Project, TestRun, Issue, AIInsight } from '@/lib/demoData';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();
  const { getToken, orgId } = useAuth();
  const userName = user?.firstName || 'Developer';

  // State hooks for dashboard elements
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [testRuns, setTestRuns] = React.useState<TestRun[]>([]);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [insights, setInsights] = React.useState<AIInsight[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Resolve time-aware greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  React.useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const token = await getToken({ template: 'supabase' });
        if (token) {
          const [projs, runs, iss, ins] = await Promise.all([
            getProjects(token, orgId),
            getTestRuns(token, orgId),
            getIssues(token, orgId),
            getAIInsights(token, orgId),
          ]);
          setProjects(projs);
          setTestRuns(runs);
          setIssues(iss);
          setInsights(ins);
        }
      } catch (e) {
        console.error('[Dashboard Load Error]: Failed loading multi-tenant database summary.', e);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [getToken, orgId]);

  // Compute live statistics summary values from data layer
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
  const passedCount = testRuns.filter((r) => r.status === 'passed').length;
  const scoreAverage = projects.length > 0 
    ? Math.round(projects.reduce((acc, p) => acc + p.releaseScore, 0) / projects.length) 
    : 100;

  const statsList = [
    { label: 'Total Projects', value: projects.length, changePercent: projects.length > 0 ? 0 : undefined, timeframe: 'Current target workspaces' },
    { label: 'Total Test Runs', value: testRuns.length, changePercent: testRuns.length > 0 ? undefined : undefined, timeframe: 'All sweeps executed' },
    { label: 'Critical Issues', value: criticalCount, changePercent: criticalCount > 0 ? undefined : undefined, timeframe: 'Require immediate resolution' },
    { label: 'Avg Release Score', value: `${scoreAverage}%`, changePercent: undefined, timeframe: 'Stability baseline index' },
  ];

  return (
    <AppShell>
      <Stack spacing={24}>
        {/* Welcome Section */}
        <Flex justify="between" align="center" wrap={true} className="gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              {greeting}, {userName}.
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Your software quality command center.
            </p>
          </div>
          <Flex className="gap-3">
            <Link href="/projects">
              <Button variant="accent" size="sm">Start a Test</Button>
            </Link>
            <Link href="/projects">
              <Button variant="outline" size="sm">Create Project</Button>
            </Link>
          </Flex>
        </Flex>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading workspace summary metrics...</div>
        ) : (
          <>
            {/* 1. Key Stability Scorecards Grid */}
            <Grid cols={1} colsMd={3} gap={16}>
              <ReleaseScoreWidget score={scoreAverage} label="Workspace Stability Score" />
              <BugCounterWidget 
                counts={{
                  critical: issues.filter((i) => i.severity === 'critical').length,
                  high: issues.filter((i) => i.severity === 'high').length,
                  medium: issues.filter((i) => i.severity === 'medium').length,
                  low: issues.filter((i) => i.severity === 'low').length,
                }} 
              />
              <AIInsightsWidget
                insights={insights.map((ins) => ({
                  id: ins.id,
                  agent: 'Diagnostics Agent',
                  severity: ins.severity === 'critical' ? 'critical' : 'high',
                  finding: ins.message,
                  recommendation: 'Verify recently connected routes, packages, and style configurations.',
                }))}
              />
            </Grid>

            {/* 2. Numeric Statistics Summary */}
            <StatisticsWidget items={statsList} />

            {/* 3. Dynamic Lists: Recent Test Runs & Detected Issues */}
            <Grid cols={1} colsLg={3} gap={24}>
              {/* Recent Test Runs (Left 2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                  Recent Test Runs
                </h2>
                <TestRunTable runs={testRuns.slice(0, 5)} />
              </div>

              {/* Recent Issues List (Right 1 col) */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                  Open Vulnerabilities
                </h2>
                <IssueList issues={issues.slice(0, 4)} />
              </div>
            </Grid>
          </>
        )}
      </Stack>
    </AppShell>
  );
}
