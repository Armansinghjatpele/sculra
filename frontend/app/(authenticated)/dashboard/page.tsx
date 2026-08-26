import * as React from 'react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { ReleaseScoreWidget, StatisticsWidget, BugCounterWidget, AIInsightsWidget } from '@/components/DashboardWidgets';
import { TestRunTable } from '@/components/TestRunTable';
import { IssueList } from '@/components/IssueList';
import { getProjects, getTestRuns, getIssues, getAIInsights } from '@/services/db';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await currentUser();
  const { getToken, orgId } = await auth();
  const userName = user?.firstName || 'Developer';
  const token = await getToken();

  // Resolve time-aware greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Fetch all dashboard summaries in parallel on the server
  let projects: Project[] = [];
  let testRuns: TestRun[] = [];
  let issues: Issue[] = [];
  let insights: AIInsight[] = [];

  if (token) {
    [projects, testRuns, issues, insights] = await Promise.all([
      getProjects(token, orgId),
      getTestRuns(token, orgId),
      getIssues(token, orgId),
      getAIInsights(token, orgId),
    ]);
  }

  // Compute live statistics summary values from data layer
  const criticalCount = issues.filter((i) => i.severity === 'critical').length;
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
    <Stack spacing={24}>
      {/* Welcome Section */}
      <Flex justify="between" align="center" wrap={true} className="gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {greeting}, {userName}.
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Here's what's happening across your applications.
          </p>
        </div>
        <Flex className="gap-3">
          <Link href="/projects">
            <Button variant="accent" size="sm">+ Add Project</Button>
          </Link>
        </Flex>
      </Flex>

      {projects.length === 0 ? (
        /* FIRST PROJECT EMPTY STATE */
        <div className="border border-white/5 bg-zinc-950/20 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-6 shadow-glass my-8">
          <div className="h-10 w-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent text-lg font-bold">
            +
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-foreground">Start testing your first application.</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect an application and let Sculra explore it for you. Catch functional bugs, responsive shifts, and accessibility flaws automatically.
            </p>
          </div>

          <div className="pt-2">
            <Link href="/projects">
              <Button variant="accent" size="lg">Add Project</Button>
            </Link>
          </div>

          {/* Ingestion sources tags */}
          <div className="flex flex-wrap justify-center items-center gap-3 pt-6 border-t border-white/5 font-mono text-[9px] text-muted-foreground">
            <span className="text-foreground">Website (Active)</span>
            <span>•</span>
            <span className="text-foreground">GitHub (Active)</span>
            <span>•</span>
            <span>ZIP (Coming soon)</span>
            <span>•</span>
            <span>Desktop (Coming soon)</span>
            <span>•</span>
            <span>API (Coming soon)</span>
          </div>
        </div>
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

          {/* 3. TEST ACTIVITY VISUALIZATION */}
          <Card className="glass-panel w-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Test Activity
              </CardTitle>
              <CardDescription>Daily automation run status (Past 7 Days)</CardDescription>
            </CardHeader>
            <CardContent className="h-48 pt-4 relative">
              {/* SVG Bar Chart */}
              <svg className="w-full h-full font-mono text-[8px] text-muted-foreground" viewBox="0 0 700 160">
                <line x1="30" y1="120" x2="670" y2="120" stroke="rgba(255,255,255,0.06)" />
                <line x1="30" y1="80" x2="670" y2="80" stroke="rgba(255,255,255,0.06)" />
                <line x1="30" y1="40" x2="670" y2="40" stroke="rgba(255,255,255,0.06)" />

                {/* Mon */}
                <g>
                  <rect x="75" y="50" width="16" height="70" rx="2" fill="var(--accent)" />
                  <rect x="95" y="100" width="16" height="20" rx="2" fill="var(--danger)" />
                  <text x="85" y="140" textAnchor="middle">Mon</text>
                </g>
                {/* Tue */}
                <g>
                  <rect x="165" y="40" width="16" height="80" rx="2" fill="var(--accent)" />
                  <rect x="185" y="110" width="16" height="10" rx="2" fill="var(--danger)" />
                  <text x="175" y="140" textAnchor="middle">Tue</text>
                </g>
                {/* Wed */}
                <g>
                  <rect x="255" y="60" width="16" height="60" rx="2" fill="var(--accent)" />
                  <rect x="275" y="120" width="16" height="0" rx="2" fill="var(--danger)" />
                  <text x="265" y="140" textAnchor="middle">Wed</text>
                </g>
                {/* Thu */}
                <g>
                  <rect x="345" y="30" width="16" height="90" rx="2" fill="var(--accent)" />
                  <rect x="365" y="105" width="16" height="15" rx="2" fill="var(--danger)" />
                  <text x="355" y="140" textAnchor="middle">Thu</text>
                </g>
                {/* Fri */}
                <g>
                  <rect x="435" y="70" width="16" height="50" rx="2" fill="var(--accent)" />
                  <rect x="455" y="120" width="16" height="0" rx="2" fill="var(--danger)" />
                  <text x="445" y="140" textAnchor="middle">Fri</text>
                </g>
                {/* Sat */}
                <g>
                  <rect x="525" y="100" width="16" height="20" rx="2" fill="var(--accent)" />
                  <rect x="545" y="120" width="16" height="0" rx="2" fill="var(--danger)" />
                  <text x="535" y="140" textAnchor="middle">Sat</text>
                </g>
                {/* Sun */}
                <g>
                  <rect x="615" y="110" width="16" height="10" rx="2" fill="var(--accent)" />
                  <rect x="635" y="120" width="16" height="0" rx="2" fill="var(--danger)" />
                  <text x="625" y="140" textAnchor="middle">Sun</text>
                </g>
              </svg>

              <div className="absolute top-2 right-4 flex gap-4 font-mono text-[8px]">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-accent" />
                  <span>Passed Runs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-danger" />
                  <span>Failed Runs</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Dynamic Lists: Recent Test Runs & Detected Issues */}
          <Grid cols={1} colsLg={3} gap={24}>
            {/* Recent Test Runs (Left 2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                Recent Test Runs
              </h2>
              {testRuns.length > 0 ? (
                <TestRunTable runs={testRuns.slice(0, 5)} />
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground border border-white/5 rounded-lg bg-zinc-900/30">
                  No recent test runs completed.
                </div>
              )}
            </div>

            {/* Recent Issues List (Right 1 col) */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
                Open Issues
              </h2>
              {issues.length > 0 ? (
                <IssueList issues={issues.slice(0, 4)} />
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground border border-white/5 rounded-lg bg-zinc-900/30">
                  No open issues detected.
                </div>
              )}
            </div>
          </Grid>
        </>
      )}
    </Stack>
  );
}
