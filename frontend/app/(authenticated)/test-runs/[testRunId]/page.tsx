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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import { TestRun, TestEvidence } from '@/lib/demoData';

interface TestRunDetailPageProps {
  params: Promise<{ testRunId: string }>;
}

export default function TestRunDetailPage({ params }: TestRunDetailPageProps) {
  const resolvedParams = use(params);
  const testRunId = resolvedParams.testRunId;
  const { getToken } = useAuth();

  const [testRun, setTestRun] = React.useState<TestRun | null>(null);
  const [evidence, setEvidence] = React.useState<TestEvidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cancelling, setCancelling] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('overview');
  const [selectedScreenshot, setSelectedScreenshot] = React.useState<string | null>(null);
  const [expandedPageUrl, setExpandedPageUrl] = React.useState<string | null>(null);
  const [expandedJourneyId, setExpandedJourneyId] = React.useState<string | null>(null);

  const fetchRunDetails = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/test-runs/${testRunId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.testRun) {
          setTestRun(data.testRun);
          setEvidence(data.evidence || []);
        }
      }
    } catch (e) {
      console.error('[TestRunDetail Fetch Error]:', e);
    } finally {
      setLoading(false);
    }
  }, [testRunId]);

  // Initial load
  React.useEffect(() => {
    fetchRunDetails();
  }, [fetchRunDetails]);

  // Auto-polling interval while queued or running
  React.useEffect(() => {
    if (!testRun || testRun.status === 'queued' || testRun.status === 'running') {
      const interval = setInterval(() => {
        fetchRunDetails();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [testRun, fetchRunDetails]);

  const handleCancelRun = async () => {
    if (!testRun) return;
    try {
      setCancelling(true);
      const res = await fetch(`/api/test-runs/${testRunId}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchRunDetails();
      }
    } catch (e) {
      console.error('[Cancel Run Exception]:', e);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-muted-foreground font-mono">
        <div className="animate-spin h-5 w-5 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3" />
        Loading test run execution telemetry...
      </div>
    );
  }

  if (!testRun) {
    return (
      <div className="py-16 text-center max-w-sm mx-auto space-y-4">
        <h1 className="text-lg font-bold text-foreground">Test Run Not Found</h1>
        <p className="text-xs text-muted-foreground">The requested test run ID does not exist in your workspace.</p>
        <Link href="/test-runs">
          <Button variant="accent" size="sm">Back to Test Runs</Button>
        </Link>
      </div>
    );
  }

  // Evidence groupings
  const screenshots = evidence.filter((e) => e.type === 'screenshot' || e.type === 'responsive_capture');
  const consoleErrors = evidence.filter((e) => e.type === 'console_error');
  const networkErrors = evidence.filter((e) => e.type === 'network_error');
  const navigationItem = evidence.find((e) => e.type === 'navigation');
  const appMapEvidence = evidence.find((e) => e.type === 'application_map');
  const appMap = appMapEvidence?.metadata?.applicationMap;
  const journeyResults: any[] = evidence
    .filter((e) => e.type === 'journey_result')
    .map((e) => e.metadata?.journeyResult)
    .filter(Boolean);

  const isTerminal = testRun.status === 'passed' || testRun.status === 'failed' || testRun.status === 'cancelled';

  // Total journey actions summary
  let totalActionsAttempted = 0;
  let totalActionsPassed = 0;
  let totalActionsFailed = 0;
  let totalActionsSkipped = 0;
  let totalObservationsCount = 0;

  for (const j of journeyResults) {
    totalActionsAttempted += j.actionsAttempted || 0;
    totalActionsPassed += j.actionsPassed || 0;
    totalActionsFailed += j.actionsFailed || 0;
    totalActionsSkipped += j.actionsSkipped || 0;
    totalObservationsCount += (j.observations || []).length;
  }

  return (
    <Stack spacing={24}>
      {/* Header */}
      <PageHeader
        title={`Test Run: ${testRun.projectName}`}
        description={`Target URL: ${testRun.url || 'Configured Endpoint'} | Trigger: Manual`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={testRun.status} />
            {!isTerminal && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelRun}
                disabled={cancelling}
                className="text-danger hover:bg-danger/10 border-danger/30 text-xs"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Run'}
              </Button>
            )}
            <Link href={testRun.projectId ? `/projects/${testRun.projectId}` : '/test-runs'}>
              <Button variant="outline" size="sm">Back to Project</Button>
            </Link>
          </div>
        }
      />

      {/* Progressive Truthful State Banner */}
      {testRun.status === 'queued' && (
        <div className="border border-warning/30 bg-warning/5 rounded-2xl p-6 flex items-center justify-between gap-4 font-mono text-xs shadow-glass">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center text-warning text-sm font-bold animate-pulse">
              ⏳
            </div>
            <div>
              <span className="font-bold text-foreground block">Your test is queued.</span>
              <p className="text-muted-foreground text-3xs mt-0.5">
                Waiting for browser worker to allocate execution instance.
              </p>
            </div>
          </div>
          <span className="text-3xs text-muted-foreground uppercase tracking-widest animate-pulse">
            ● Worker Polling Active
          </span>
        </div>
      )}

      {testRun.status === 'running' && (
        <div className="border border-accent/30 bg-accent/5 rounded-2xl p-6 flex items-center justify-between gap-4 font-mono text-xs shadow-glass">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div>
              <span className="font-bold text-foreground block">Browser Execution & User Journeys in Progress</span>
              <p className="text-muted-foreground text-3xs mt-0.5">
                Executing application discovery, exercising deterministic user journeys, and logging network telemetry...
              </p>
            </div>
          </div>
          <span className="text-3xs text-accent font-bold uppercase tracking-wider animate-pulse">
            ● Live Browser Running
          </span>
        </div>
      )}

      {testRun.status === 'passed' && (
        <div className="border border-success/30 bg-success/5 rounded-2xl p-6 flex items-center justify-between gap-4 font-mono text-xs shadow-glass">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-success/10 border border-success/20 flex items-center justify-center text-success font-bold text-sm">
              ✓
            </div>
            <div>
              <span className="font-bold text-foreground block">Test Execution Completed (Passed)</span>
              <p className="text-muted-foreground text-3xs mt-0.5">
                Target responded successfully with HTTP 200 OK. Application discovery & user journeys verified cleanly.
              </p>
            </div>
          </div>
          <span className="text-3xs text-success font-bold uppercase tracking-widest">
            ● Execution Succeeded
          </span>
        </div>
      )}

      {testRun.status === 'failed' && (
        <div className="border border-danger/30 bg-danger/5 rounded-2xl p-6 flex items-center justify-between gap-4 font-mono text-xs shadow-glass">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger font-bold text-sm">
              ✕
            </div>
            <div>
              <span className="font-bold text-foreground block">Test Execution Completed (Failed)</span>
              <p className="text-muted-foreground text-3xs mt-0.5">
                Exceptions were detected during execution. Inspect the evidence and user journey tabs below for details.
              </p>
            </div>
          </div>
          <span className="text-3xs text-danger font-bold uppercase tracking-widest">
            ● Execution Failed
          </span>
        </div>
      )}

      {testRun.status === 'cancelled' && (
        <div className="border border-white/10 bg-zinc-900/40 rounded-2xl p-6 flex items-center justify-between gap-4 font-mono text-xs shadow-glass">
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground font-bold text-sm">
              ⊘
            </div>
            <div>
              <span className="font-bold text-foreground block">Test Execution Cancelled</span>
              <p className="text-muted-foreground text-3xs mt-0.5">
                This test run was terminated upon user request.
              </p>
            </div>
          </div>
          <span className="text-3xs text-muted-foreground uppercase tracking-widest">
            ● Cancelled
          </span>
        </div>
      )}

      {/* Summary Scorecards Grid */}
      <Grid cols={1} colsMd={4} gap={16}>
        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Status</CardDescription>
            <CardTitle className="text-lg font-extrabold text-foreground mt-1 capitalize">
              {testRun.status}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            Created: {testRun.createdAt}
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Execution Duration</CardDescription>
            <CardTitle className="text-lg font-extrabold text-foreground mt-1 font-mono">
              {testRun.durationMs ? `${(testRun.durationMs / 1000).toFixed(2)}s` : '--'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            {testRun.startedAt ? `Started: ${testRun.startedAt}` : 'Awaiting start'}
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">User Journeys</CardDescription>
            <CardTitle className="text-lg font-extrabold mt-1 font-mono text-accent">
              {journeyResults.length > 0 ? `${journeyResults.length} Flows` : (appMap ? `${appMap.totalPages} Pages` : '--')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            {journeyResults.length > 0
              ? `${totalActionsPassed} passed · ${totalActionsFailed} failed`
              : (appMap ? `${appMap.totalButtons} buttons · ${appMap.totalForms} forms` : 'Awaiting execution')}
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Issues & Observations</CardDescription>
            <CardTitle className={`text-lg font-extrabold mt-1 font-mono ${consoleErrors.length + networkErrors.length > 0 ? 'text-danger' : 'text-success'}`}>
              {consoleErrors.length + networkErrors.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            {consoleErrors.length} console · {networkErrors.length} network · {totalObservationsCount} observations
          </CardContent>
        </Card>
      </Grid>

      {/* Evidence & Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview & Navigation</TabsTrigger>
          <TabsTrigger value="journeys">
            User Journeys {journeyResults.length > 0 && `(${journeyResults.length})`}
          </TabsTrigger>
          <TabsTrigger value="appmap">
            Application Map {appMap && `(${appMap.totalPages})`}
          </TabsTrigger>
          <TabsTrigger value="screenshots">
            Screenshots {screenshots.length > 0 && `(${screenshots.length})`}
          </TabsTrigger>
          <TabsTrigger value="console">
            Console Logs {consoleErrors.length > 0 && `(${consoleErrors.length})`}
          </TabsTrigger>
          <TabsTrigger value="network">
            Network Requests {networkErrors.length > 0 && `(${networkErrors.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview & Navigation */}
        <TabsContent value="overview">
          <div className="mt-4 space-y-4">
            <div className="bg-zinc-900/20 border border-white/5 p-6 rounded-xl space-y-4 font-mono text-xs">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                Execution Metadata
              </h3>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-muted-foreground">Test Run ID</span>
                <span className="text-foreground font-semibold">{testRun.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-muted-foreground">Target URL</span>
                <span className="text-accent font-semibold">{testRun.url || 'Not configured'}</span>
              </div>
              {navigationItem?.metadata?.pageTitle && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">Page Title</span>
                  <span className="text-foreground">{navigationItem.metadata.pageTitle}</span>
                </div>
              )}
              {navigationItem?.metadata?.statusCode && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">Response Status Code</span>
                  <span className="text-foreground font-bold">HTTP {navigationItem.metadata.statusCode}</span>
                </div>
              )}
              {navigationItem?.metadata?.finalUrl && (
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">Final Destination URL</span>
                  <span className="text-foreground">{navigationItem.metadata.finalUrl}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Evidence Records Collected</span>
                <span className="text-foreground">{evidence.length} items</span>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: User Journeys (Prompt 14 Addition) */}
        <TabsContent value="journeys">
          <div className="mt-4 space-y-6">
            {journeyResults.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Planning and executing user journeys in background...'
                  : 'No user journeys executed for this run.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Journey Metrics Header */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Journeys</span>
                    <span className="text-lg font-bold text-foreground">{journeyResults.length}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-success/20 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-success block">Passed Actions</span>
                    <span className="text-lg font-bold text-success">{totalActionsPassed}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-danger/20 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-danger block">Failed Actions</span>
                    <span className="text-lg font-bold text-danger">{totalActionsFailed}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Skipped Actions</span>
                    <span className="text-lg font-bold text-foreground">{totalActionsSkipped}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-warning/20 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-warning block">Observations</span>
                    <span className="text-lg font-bold text-warning">{totalObservationsCount}</span>
                  </div>
                </div>

                {/* Journeys List & Step Timelines */}
                <div className="space-y-4">
                  {journeyResults.map((j: any, jIdx: number) => {
                    const isExpanded = expandedJourneyId === j.journeyId || (expandedJourneyId === null && jIdx === 0);
                    return (
                      <div
                        key={jIdx}
                        className="border border-white/10 bg-zinc-900/30 rounded-xl overflow-hidden font-mono text-xs transition-all"
                      >
                        {/* Journey Header */}
                        <div
                          className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                          onClick={() => setExpandedJourneyId(isExpanded ? '' : j.journeyId)}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-3xs ${j.status === 'PASSED' ? 'bg-success/10 text-success border border-success/30' : j.status === 'FAILED' ? 'bg-danger/10 text-danger border border-danger/30' : 'bg-warning/10 text-warning border border-warning/30'}`}>
                              {j.status === 'PASSED' ? '✓' : j.status === 'FAILED' ? '✕' : '●'}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{j.name}</span>
                                <span className="px-2 py-0.5 rounded text-[10px] bg-accent/10 text-accent uppercase border border-accent/20">
                                  {j.category}
                                </span>
                                {j.viewport && (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-muted-foreground border border-white/5">
                                    {j.viewport.name} ({j.viewport.width}x{j.viewport.height})
                                  </span>
                                )}
                              </div>
                              <span className="text-3xs text-muted-foreground block mt-0.5">
                                {j.steps.length} Steps · Duration: {(j.durationMs / 1000).toFixed(2)}s · Pages: {j.pagesVisited?.length || 1}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-3xs">
                            <span className="text-success font-bold">{j.actionsPassed} passed</span>
                            {j.actionsFailed > 0 && <span className="text-danger font-bold">{j.actionsFailed} failed</span>}
                            {j.actionsSkipped > 0 && <span className="text-muted-foreground">{j.actionsSkipped} skipped</span>}
                            <span className="text-sm font-bold text-foreground">{isExpanded ? '−' : '+'}</span>
                          </div>
                        </div>

                        {/* Step Timeline Details */}
                        {isExpanded && (
                          <div className="p-4 pt-0 border-t border-white/5 space-y-3">
                            <h4 className="text-3xs uppercase tracking-wider text-muted-foreground font-bold mt-3 mb-1">
                              Action Timeline
                            </h4>
                            <div className="space-y-2">
                              {j.steps.map((step: any, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="p-3 bg-zinc-950/40 rounded-lg border border-white/5 space-y-1 text-3xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-muted-foreground font-bold">#{sIdx + 1}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-foreground font-bold uppercase text-[10px]">
                                        {step.action}
                                      </span>
                                      <span className="text-foreground font-semibold">{step.targetDescription}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${step.status === 'PASSED' ? 'bg-success/10 text-success' : step.status === 'FAILED' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}`}>
                                        {step.status}
                                      </span>
                                      <span className="text-muted-foreground text-[10px]">{step.durationMs}ms</span>
                                    </div>
                                  </div>

                                  {step.selector && (
                                    <p className="text-muted-foreground text-[10px]">Selector: {step.selector}</p>
                                  )}

                                  {step.beforeUrl !== step.afterUrl && (
                                    <p className="text-accent text-[10px]">
                                      Transition: {step.beforeUrl} → {step.afterUrl}
                                    </p>
                                  )}

                                  {step.error && (
                                    <p className="text-danger font-semibold text-[10px] mt-1">Error: {step.error}</p>
                                  )}

                                  {/* Step Observations */}
                                  {step.observations && step.observations.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-white/5">
                                      {step.observations.map((obs: any, oIdx: number) => (
                                        <span
                                          key={oIdx}
                                          className="px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[9px] border border-warning/20"
                                        >
                                          ● [{obs.type}]: {obs.message}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Application Map */}
        <TabsContent value="appmap">
          <div className="mt-4 space-y-6">
            {!appMap ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Mapping application structure in background...'
                  : 'No application structure discovered for this run.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Discovery Metrics Header */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center font-mono">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Pages</span>
                    <span className="text-lg font-bold text-foreground">{appMap.totalPages}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center font-mono">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Forms</span>
                    <span className="text-lg font-bold text-foreground">{appMap.totalForms}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center font-mono">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Buttons</span>
                    <span className="text-lg font-bold text-foreground">{appMap.totalButtons}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center font-mono">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Inputs</span>
                    <span className="text-lg font-bold text-foreground">{appMap.totalInputs}</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center font-mono">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Links</span>
                    <span className="text-lg font-bold text-foreground">{appMap.totalLinks}</span>
                  </div>
                </div>

                {/* Responsive Viewport Preview Cards */}
                {appMap.responsiveCaptures && appMap.responsiveCaptures.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                      Responsive Viewport Captures
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {appMap.responsiveCaptures.map((cap: any, idx: number) => (
                        <Card key={idx} className="glass-panel overflow-hidden border border-white/10">
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-center justify-between">
                              <span className="text-3xs uppercase font-bold text-accent font-mono">
                                {cap.viewport.name} ({cap.viewport.width}×{cap.viewport.height})
                              </span>
                              <span className="text-4xs text-muted-foreground font-mono">
                                Body: {cap.layoutMetadata.bodyWidth}×{cap.layoutMetadata.bodyHeight}px
                              </span>
                            </div>
                          </CardHeader>
                          <CardContent className="p-3 pt-2">
                            {cap.screenshot && (
                              <div className="rounded-lg overflow-hidden border border-white/5 bg-zinc-950/40 p-2 text-center text-3xs font-mono text-muted-foreground">
                                Viewport Captured ({cap.viewport.width}x{cap.viewport.height})
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discovered Pages List */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                    Discovered Application Pages ({appMap.pages.length})
                  </h3>

                  <div className="space-y-3">
                    {appMap.pages.map((p: any, idx: number) => {
                      const isExpanded = expandedPageUrl === p.url || (expandedPageUrl === null && idx === 0);
                      return (
                        <div
                          key={idx}
                          className="border border-white/10 bg-zinc-900/30 rounded-xl overflow-hidden font-mono text-xs transition-all"
                        >
                          <div
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                            onClick={() => setExpandedPageUrl(isExpanded ? '' : p.url)}
                          >
                            <div className="flex items-center gap-3">
                              <span className="h-6 w-6 rounded-full bg-accent/10 border border-accent/20 text-accent flex items-center justify-center font-bold text-3xs">
                                {p.depth}
                              </span>
                              <div>
                                <span className="font-bold text-foreground block">{p.title || 'Untitled Page'}</span>
                                <span className="text-3xs text-muted-foreground">{p.url}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-3xs text-muted-foreground">
                              <span>{p.forms.length} forms</span>
                              <span>·</span>
                              <span>{p.elements.filter((e: any) => e.type === 'button').length} buttons</span>
                              <span>·</span>
                              <span>{p.links.length} links</span>
                              <span className="text-sm font-bold text-foreground">{isExpanded ? '−' : '+'}</span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-4 pt-0 border-t border-white/5 space-y-4 text-3xs">
                              {/* Forms Section */}
                              {p.forms.length > 0 && (
                                <div className="space-y-2 mt-3">
                                  <span className="font-bold text-accent uppercase tracking-wider block">
                                    Discovered Forms ({p.forms.length})
                                  </span>
                                  <div className="space-y-2">
                                    {p.forms.map((form: any, fIdx: number) => (
                                      <div key={fIdx} className="p-3 bg-zinc-950/40 rounded-lg border border-white/5 space-y-2">
                                        <div className="flex items-center justify-between text-muted-foreground">
                                          <span className="text-foreground font-semibold">
                                            {form.method} {form.action || 'Default Action'}
                                          </span>
                                          <span>{form.fields.length} input fields</span>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                          {form.fields.map((fld: any, flIdx: number) => (
                                            <div key={flIdx} className="p-2 bg-zinc-900/60 rounded border border-white/5 text-muted-foreground">
                                              <span className="text-foreground font-semibold block">{fld.name} ({fld.type})</span>
                                              {fld.label && <span>Label: {fld.label} · </span>}
                                              {fld.required && <span className="text-danger font-bold">Required · </span>}
                                              <span className="text-muted-foreground text-[10px]">Selector: {fld.selector}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Interactive Elements / Buttons */}
                              {p.elements.filter((e: any) => e.type === 'button').length > 0 && (
                                <div className="space-y-2">
                                  <span className="font-bold text-accent uppercase tracking-wider block">
                                    Interactive Buttons ({p.elements.filter((e: any) => e.type === 'button').length})
                                  </span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {p.elements.filter((e: any) => e.type === 'button').map((btn: any, bIdx: number) => (
                                      <div key={bIdx} className="p-2 bg-zinc-950/40 rounded border border-white/5">
                                        <span className="text-foreground font-bold block">{btn.text || btn.accessibleName || 'Button'}</span>
                                        <span className="text-muted-foreground text-[10px]">Selector: {btn.selector}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Links */}
                              {p.links.length > 0 && (
                                <div className="space-y-2">
                                  <span className="font-bold text-muted-foreground uppercase tracking-wider block">
                                    Discovered Links ({p.links.length})
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {p.links.map((l: any, lIdx: number) => (
                                      <span
                                        key={lIdx}
                                        className={`px-2 py-1 rounded text-[10px] border ${l.isInternal ? 'bg-accent/5 text-accent border-accent/20' : 'bg-zinc-800 text-muted-foreground border-white/5'}`}
                                      >
                                        {l.text || l.href}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Screenshots */}
        <TabsContent value="screenshots">
          <div className="mt-4 space-y-4">
            {screenshots.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Capturing browser viewport screenshot...'
                  : 'No screenshots captured for this run.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {screenshots.map((s) => (
                  <Card key={s.id} className="glass-panel overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold text-foreground truncate">{s.title}</CardTitle>
                      <CardDescription className="font-mono text-3xs">{s.url}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {s.message ? (
                        <div
                          className="relative rounded-lg overflow-hidden border border-white/10 bg-zinc-950 cursor-pointer group"
                          onClick={() => setSelectedScreenshot(s.message || null)}
                        >
                          <img
                            src={s.message}
                            alt={s.title}
                            className="w-full h-auto max-h-80 object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono font-bold">
                            Click to Expand
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center text-3xs text-muted-foreground font-mono">
                          Saved to {s.storagePath}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 5: Console Logs */}
        <TabsContent value="console">
          <div className="mt-4 space-y-4">
            {consoleErrors.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                ✓ No browser console errors were thrown during page execution.
              </div>
            ) : (
              <div className="space-y-3">
                {consoleErrors.map((err) => (
                  <div
                    key={err.id}
                    className="p-4 border border-danger/20 bg-danger/5 rounded-xl space-y-1.5 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-danger font-bold uppercase tracking-wider text-[10px]">
                        ● Console Error
                      </span>
                      {err.metadata?.timestamp && (
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(err.metadata.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground font-semibold break-all">{err.message}</p>
                    {err.metadata?.location && (
                      <p className="text-muted-foreground text-[10px] break-all">
                        Location: {err.metadata.location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 6: Network Requests */}
        <TabsContent value="network">
          <div className="mt-4 space-y-4">
            {networkErrors.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                ✓ All network requests succeeded without HTTP 4xx/5xx errors.
              </div>
            ) : (
              <div className="space-y-3">
                {networkErrors.map((net) => (
                  <div
                    key={net.id}
                    className="p-4 border border-warning/20 bg-warning/5 rounded-xl space-y-1.5 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-warning font-bold uppercase tracking-wider text-[10px]">
                        ● {net.metadata?.method || 'GET'} {net.metadata?.status ? `HTTP ${net.metadata.status}` : 'FAILED'}
                      </span>
                      {net.metadata?.resourceType && (
                        <span className="text-muted-foreground text-[10px] uppercase">
                          Type: {net.metadata.resourceType}
                        </span>
                      )}
                    </div>
                    <p className="text-foreground font-semibold break-all">{net.url}</p>
                    {net.message && (
                      <p className="text-muted-foreground text-[10px]">{net.message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Screenshot Zoom Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setSelectedScreenshot(null)}
              className="absolute top-4 right-4 bg-zinc-900 border border-white/10 text-white rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold hover:bg-zinc-800 z-10"
            >
              ×
            </button>
            <img
              src={selectedScreenshot}
              alt="Expanded Screenshot"
              className="max-h-[85vh] w-auto mx-auto rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </Stack>
  );
}
