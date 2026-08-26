'use client';

import * as React from 'react';
import { useUser } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { ReleaseScoreWidget, StatisticsWidget, BugCounterWidget, AIInsightsWidget } from '@/components/DashboardWidgets';
import { TestRunTable } from '@/components/TestRunTable';
import { IssueList } from '@/components/IssueList';
import { mockTestRuns, mockIssues, mockAIInsights } from '@/lib/demoData';
import Link from 'next/link';

export default function DashboardPage() {
  const { user } = useUser();
  const userName = user?.firstName || 'Developer';

  // Resolve time-aware greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  // Stats mapped for Sculra Stat Cards
  const statsList = [
    { label: 'Total Projects', value: 4, changePercent: 25, timeframe: 'Last 30 days' },
    { label: 'Total Test Runs', value: 124, changePercent: 12, timeframe: 'Last 30 days' },
    { label: 'Testing Minutes', value: '342m', changePercent: 18, timeframe: 'Last 30 days' },
    { label: 'Latest Release Score', value: '94%', changePercent: 2, timeframe: 'Current stability' },
  ];

  return (
    <AppShell>
      <Stack spacing={24}>
        {/* Welcome Section */}
        <Flex justify="between" align="center" wrap="wrap" className="gap-4">
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

        {/* 1. Key Stability Scorecards Grid */}
        <Grid cols={1} colsMd={3} gap={16}>
          {/* Release Readiness illustrative widget */}
          <ReleaseScoreWidget score={82} label="Release Readiness Score" />
          <BugCounterWidget counts={{ critical: 1, high: 2, medium: 4, low: 2 }} />
          <AIInsightsWidget
            insights={[
              { id: '1', agent: 'Diagnostics', severity: 'warning', finding: '3 issues appear related to the latest GitHub branch deployment.', recommendation: 'Verify recent cookie and alignment headers.' }
            ]}
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
            <TestRunTable runs={mockTestRuns} />
          </div>

          {/* Recent Issues List (Right 1 col) */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">
              Open Vulnerabilities
            </h2>
            <IssueList issues={mockIssues.slice(0, 3)} />
          </div>
        </Grid>
      </Stack>
    </AppShell>
  );
}
