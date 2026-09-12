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
import { TestRun, TestEvidence, Issue, QASignalRecord } from '@/lib/demoData';
import { IssueList } from '@/components/IssueList';
import { formatPerformanceScore, formatPerformanceMetric, formatTargetsEvaluated } from '@/lib/performanceUtils';
import { formatAccessibilityScore, getAccessibilityScoreColor, getAccessibilitySeverityBadge } from '@/lib/accessibilityUtils';
import {
  formatScoreDelta,
  getScoreDeltaColor,
  getTrendBadge,
  getFindingHistoricalBadge,
  getStabilityBadge,
} from '@/lib/historyUtils';

interface TestRunDetailPageProps {
  params: Promise<{ testRunId: string }>;
}

export default function TestRunDetailPage({ params }: TestRunDetailPageProps) {
  const resolvedParams = use(params);
  const testRunId = resolvedParams.testRunId;
  const { getToken } = useAuth();

  const [testRun, setTestRun] = React.useState<TestRun | null>(null);
  const [evidence, setEvidence] = React.useState<TestEvidence[]>([]);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [signals, setSignals] = React.useState<QASignalRecord[]>([]);
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
          setIssues(data.issues || []);
          setSignals(data.signals || []);
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
  const visualComparisons = evidence.filter((e) => e.type === 'visual_comparison');
  const responsiveObservations = evidence.filter((e) => e.type === 'responsive_observation');
  const aiQaPlans: any[] = evidence
    .filter((e) => e.type === 'ai_qa_plan')
    .map((e) => e.metadata?.plan)
    .filter(Boolean);
  const aiQaResults: any[] = evidence
    .filter((e) => e.type === 'ai_qa_result')
    .map((e) => e.metadata?.result)
    .filter(Boolean);
  const aiQaStateEvidence = evidence.find((e) => e.type === 'ai_qa_state_summary');
  const aiQaStateSummary = aiQaStateEvidence?.metadata?.stateSummary;
  const aiQaStopEvidence = evidence.find((e) => e.type === 'ai_qa_stop');
  const strategyDecisions: any[] = evidence
    .filter((e) => e.type === 'strategy_decision')
    .map((e) => e.metadata?.decision)
    .filter(Boolean);
  const productModelEvidence = evidence.find((e) => e.type === 'product_model');
  const productModel = productModelEvidence?.metadata?.productModel;
  const productWorkflows: any[] = evidence
    .filter((e) => e.type === 'product_workflow')
    .map((e) => e.metadata?.workflow)
    .filter(Boolean);
  const authSessions: any[] = evidence
    .filter((e) => e.type === 'authenticated_session')
    .map((e) => e.metadata)
    .filter(Boolean);
  const roleContexts: any[] = evidence
    .filter((e) => e.type === 'role_context')
    .map((e) => e.metadata?.roleContext)
    .filter(Boolean);
  const authChecks: any[] = evidence
    .filter((e) => e.type === 'authorization_check' || e.type === 'unauthorized_access')
    .map((e) => e.metadata?.authorizationCheck)
    .filter(Boolean);
  const roleComparisons: any[] = evidence
    .filter((e) => e.type === 'role_difference')
    .map((e) => e.metadata?.comparison)
    .filter(Boolean);
  const apiEndpoints: any[] = evidence
    .filter((e) => e.type === 'api_endpoint')
    .map((e) => e.metadata?.endpoint)
    .filter(Boolean);
  const apiCoverageEvidence = evidence.find((e) => e.type === 'api_coverage_summary');
  const apiCoverage = apiCoverageEvidence?.metadata?.coverage;
  const apiResponses: any[] = evidence
    .filter((e) => e.type === 'api_response' || e.type === 'api_failure')
    .map((e) => e.metadata?.testResult)
    .filter(Boolean);
  const apiFailures = apiResponses.filter((r) => r.status === 'FAILED');
  const securitySummaryEvidence = evidence.find((e) => e.type === 'security_summary');
  const securityCoverage = securitySummaryEvidence?.metadata?.coverage;
  const securityFindings: any[] = evidence
    .filter((e) => e.type === 'security_finding')
    .map((e) => e.metadata?.finding || e.metadata)
    .filter(Boolean);
  const criticalSecurityFindings = securityFindings.filter((f) => f.severity === 'critical');
  const highSecurityFindings = securityFindings.filter((f) => f.severity === 'high');
  const mediumSecurityFindings = securityFindings.filter((f) => f.severity === 'medium');

  const performanceSummaryEvidence = evidence.find((e) => e.type === 'performance_summary');
  const performanceCoverage = performanceSummaryEvidence?.metadata?.coverage;
  const performanceFindings: any[] = evidence
    .filter((e) => e.type === 'performance_finding')
    .map((e) => e.metadata?.finding || e.metadata)
    .filter(Boolean);
  const criticalPerfFindings = performanceFindings.filter((f) => f.severity === 'critical');
  const highPerfFindings = performanceFindings.filter((f) => f.severity === 'high');
  const mediumPerfFindings = performanceFindings.filter((f) => f.severity === 'medium');
  const perfRegressions = performanceFindings.filter((f) => f.type === 'PERFORMANCE_REGRESSION' || f.category === 'REGRESSION');

  const accessibilitySummaryEvidence = evidence.find((e) => e.type === 'accessibility_summary');
  const accessibilityCoverage = accessibilitySummaryEvidence?.metadata?.coverage;
  const accessibilityFindings: any[] = evidence
    .filter((e) => e.type === 'accessibility_finding')
    .map((e) => e.metadata?.finding || e.metadata)
    .filter(Boolean);
  const criticalA11yFindings = accessibilityFindings.filter((f) => f.severity === 'critical');
  const highA11yFindings = accessibilityFindings.filter((f) => f.severity === 'high');
  const mediumA11yFindings = accessibilityFindings.filter((f) => f.severity === 'medium');
  const lowA11yFindings = accessibilityFindings.filter((f) => f.severity === 'low');

  const journeyResults: any[] = evidence
    .filter((e) => e.type === 'journey_result')
    .map((e) => e.metadata?.journeyResult)
    .filter(Boolean);

  const historicalSummaryEvidence = evidence.find((e) => e.type === 'historical_summary');
  const historicalComparison = historicalSummaryEvidence?.metadata?.historicalComparison;
  const regressionEvents: any[] = evidence
    .filter((e) => e.type === 'regression_event')
    .map((e) => e.metadata?.regression)
    .filter(Boolean);
  const recoveryEvents: any[] = evidence
    .filter((e) => e.type === 'recovery_event')
    .map((e) => e.metadata?.recovery)
    .filter(Boolean);
  const recurrenceEvents: any[] = evidence
    .filter((e) => e.type === 'recurrence_event')
    .map((e) => e.metadata?.recurrence)
    .filter(Boolean);
  const stabilitySignals: any[] = evidence
    .filter((e) => e.type === 'stability_signal')
    .map((e) => e.metadata?.stability)
    .filter(Boolean);
  const trendSnapshots: any[] = evidence
    .filter((e) => e.type === 'trend_snapshot')
    .map((e) => e.metadata?.trends)
    .filter(Boolean);
  const coverageTrends: any[] = evidence
    .filter((e) => e.type === 'coverage_trend')
    .map((e) => e.metadata?.coverageTrend)
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
          <TabsTrigger value="issues">
            Issues Detected {issues.length > 0 && `(${issues.length})`}
          </TabsTrigger>
          <TabsTrigger value="history">
            History & Regressions {regressionEvents.length > 0 ? `(${regressionEvents.length} reg)` : (historicalComparison ? '(Analyzed)' : '')}
          </TabsTrigger>
          <TabsTrigger value="auth">
            Auth & Roles {(roleContexts.length > 0 || authChecks.length > 0 || authSessions.length > 0) && `(${roleContexts.length || authChecks.length || authSessions.length})`}
          </TabsTrigger>
          <TabsTrigger value="api">
            API QA {(apiEndpoints.length > 0 || apiResponses.length > 0) && `(${apiEndpoints.length || apiResponses.length})`}
          </TabsTrigger>
          <TabsTrigger value="security">
            Security QA {securityFindings.length > 0 && `(${securityFindings.length})`}
          </TabsTrigger>
          <TabsTrigger value="performance">
            Performance QA {performanceFindings.length > 0 && `(${performanceFindings.length})`}
          </TabsTrigger>
          <TabsTrigger value="accessibility">
            Accessibility QA {accessibilityFindings.length > 0 && `(${accessibilityFindings.length})`}
          </TabsTrigger>
          <TabsTrigger value="responsive">
            Responsive QA {responsiveObservations.length > 0 && `(${responsiveObservations.length})`}
          </TabsTrigger>
          <TabsTrigger value="visual">
            Visual QA {visualComparisons.length > 0 && `(${visualComparisons.length})`}
          </TabsTrigger>
          <TabsTrigger value="product">
            Product Model {productModel && `(${productModel.workflows?.length || 0})`}
          </TabsTrigger>
          <TabsTrigger value="strategy">
            AI Strategy {strategyDecisions.length > 0 && `(${strategyDecisions.length})`}
          </TabsTrigger>
          <TabsTrigger value="aiqa">
            AI QA {aiQaPlans.length > 0 && `(${aiQaPlans.length})`}
          </TabsTrigger>
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

        {/* Tab 2: Issues Detected */}
        <TabsContent value="issues">
          <div className="mt-4 space-y-6">
            {/* Issues Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
              <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Deterministic Bugs</span>
                <span className={`text-lg font-bold ${issues.length > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                  {issues.length}
                </span>
              </div>
              <div className="bg-zinc-900/40 border border-danger/20 rounded-xl p-4 text-center">
                <span className="text-3xs uppercase tracking-wider text-danger block">Critical / High</span>
                <span className="text-lg font-bold text-danger">
                  {issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length}
                </span>
              </div>
              <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Skipped Protected</span>
                <span className="text-lg font-bold text-foreground">{totalActionsSkipped}</span>
              </div>
              <div className="bg-zinc-900/40 border border-cyan-500/20 rounded-xl p-4 text-center">
                <span className="text-3xs uppercase tracking-wider text-cyan-400 block">Total Observations</span>
                <span className="text-lg font-bold text-cyan-400">{totalObservationsCount}</span>
              </div>
            </div>

            {/* Issue List */}
            {issues.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center space-y-3 font-mono">
                <div className="text-xs font-bold text-emerald-400">✓ No Deterministic Functional Bugs Detected</div>
                <p className="text-3xs text-muted-foreground">
                  All executed journey steps and interactive controls operated within safe parameters without uncaught exceptions or broken states.
                </p>
              </div>
            ) : (
              <IssueList issues={issues} />
            )}
          </div>
        </TabsContent>

        {/* Tab: Auth & Roles */}
        <TabsContent value="auth">
          <div className="mt-4 space-y-6 font-mono">
            {/* Header Banner */}
            <div className="border border-accent/20 bg-accent/5 rounded-2xl p-5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground uppercase tracking-wider text-xs">
                    Authenticated & Role-Based QA Foundation
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent text-[10px] uppercase font-bold">
                    Method: Form Login (Isolated Contexts)
                  </span>
                  {authChecks.some((c) => c.unauthorizedAccessDetected || c.verdict === 'UNAUTHORIZED_ACCESS') ? (
                    <span className="px-2.5 py-0.5 rounded bg-danger/20 border border-danger/40 text-danger text-[10px] uppercase font-bold animate-pulse">
                      Security Alert: Unauthorized Access Detected
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded bg-success/10 border border-success/20 text-success text-[10px] uppercase font-bold">
                      Authorization Intact
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-3xs max-w-2xl">
                  Evaluates authenticated user flows in isolated Playwright browser contexts, discovers role-specific surfaces, and deterministically validates access-control boundaries across configured identities.
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xs uppercase tracking-widest text-muted-foreground block">Role Contexts</span>
                <span className="text-sm font-bold text-accent font-mono">
                  {roleContexts.length} Identities Authenticated
                </span>
              </div>
            </div>

            {/* Critical Security Alert Banner if unauthorized access detected */}
            {authChecks.some((c) => c.unauthorizedAccessDetected || c.verdict === 'UNAUTHORIZED_ACCESS') && (
              <div className="border border-danger/40 bg-danger/10 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-danger/20 border border-danger/40 flex items-center justify-center text-danger font-bold text-sm">
                    ✕
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-danger uppercase tracking-wider">
                      Critical Security Violation: UNAUTHORIZED_ACCESS Detected
                    </h4>
                    <p className="text-3xs text-muted-foreground mt-0.5">
                      A non-privileged role accessed one or more protected administrative or private endpoints without expected HTTP 401/403 or denial redirects.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {roleContexts.length === 0 && authSessions.length === 0 && authChecks.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground">
                No authenticated test identities or authorization checks configured for this run.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Authenticated Role Contexts Strip */}
                {roleContexts.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Authenticated Role Contexts ({roleContexts.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roleContexts.map((rc: any, idx: number) => (
                        <div key={idx} className="p-4 bg-zinc-900/40 border border-white/10 rounded-xl space-y-3">
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-success" />
                              <span className="text-sm font-bold text-foreground">{rc.roleName}</span>
                              <span className="px-2 py-0.5 rounded bg-white/10 text-muted-foreground text-[10px] font-bold">
                                Identity: {rc.identityUsername}
                              </span>
                            </div>
                            <span className="text-3xs text-muted-foreground">
                              {rc.discoveredRoutes?.length || 0} Routes Discovered
                            </span>
                          </div>

                          {/* Discovered Routes */}
                          <div className="space-y-1">
                            <span className="text-4xs uppercase tracking-widest text-muted-foreground font-bold block">
                              Discovered Surface Routes:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {(rc.discoveredRoutes || []).map((route: string, rIdx: number) => (
                                <span
                                  key={rIdx}
                                  className="px-2 py-0.5 rounded bg-zinc-800 text-foreground text-[10px] border border-white/5 font-mono"
                                >
                                  {route}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Available Actions */}
                          {rc.availableActions && rc.availableActions.length > 0 && (
                            <div className="space-y-1 pt-1 border-t border-white/5">
                              <span className="text-4xs uppercase tracking-widest text-muted-foreground font-bold block">
                                Role-Accessible Actions ({rc.availableActions.length}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {rc.availableActions.slice(0, 6).map((act: any, aIdx: number) => (
                                  <span
                                    key={aIdx}
                                    className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[9px] border border-accent/20"
                                  >
                                    [{act.type}] {act.description || act.selector}
                                  </span>
                                ))}
                                {rc.availableActions.length > 6 && (
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-muted-foreground text-[9px]">
                                    +{rc.availableActions.length - 6} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deterministic Authorization Checks */}
                {authChecks.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Deterministic Authorization Checks ({authChecks.length})
                    </h3>
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-3xs">
                        <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                          <tr>
                            <th className="p-3 font-semibold">Role Tested</th>
                            <th className="p-3 font-semibold">Target Route</th>
                            <th className="p-3 font-semibold">Expected Behavior</th>
                            <th className="p-3 font-semibold">Actual Response</th>
                            <th className="p-3 font-semibold">Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-zinc-950/40">
                          {authChecks.map((chk: any, cIdx: number) => {
                            const isViolation = chk.unauthorizedAccessDetected || chk.verdict === 'UNAUTHORIZED_ACCESS';
                            const isPass = chk.passed;

                            return (
                              <tr key={cIdx} className={`hover:bg-white/5 ${isViolation ? 'bg-danger/10' : ''}`}>
                                <td className="p-3">
                                  <span className="font-bold text-foreground">{chk.roleName}</span>
                                </td>
                                <td className="p-3 font-mono text-accent">{chk.targetRoute}</td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-muted-foreground text-4xs uppercase">
                                    {chk.expectedBehavior}
                                  </span>
                                </td>
                                <td className="p-3 text-muted-foreground">
                                  <span>HTTP {chk.actualStatus}</span>
                                  {chk.finalUrl && chk.finalUrl !== chk.targetRoute && (
                                    <span className="block text-4xs text-muted-foreground truncate max-w-xs">
                                      Redirect: {chk.finalUrl}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                      isViolation
                                        ? 'bg-danger/20 text-danger border border-danger/40 animate-pulse'
                                        : isPass
                                        ? 'bg-success/20 text-success border border-success/30'
                                        : 'bg-warning/20 text-warning border border-warning/30'
                                    }`}
                                  >
                                    {chk.verdict}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Role Surface Difference & Comparison */}
                {roleComparisons.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Role Surface Differences & Access Boundaries
                    </h3>
                    <div className="space-y-4">
                      {roleComparisons.map((comp: any, cmpIdx: number) => (
                        <div key={cmpIdx} className="p-5 bg-zinc-950/50 border border-white/10 rounded-2xl space-y-4">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <span className="text-xs font-bold text-foreground">
                              Boundary Comparison: <span className="text-accent">{comp.roleA}</span> vs <span className="text-accent">{comp.roleB}</span>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Role A Exclusive */}
                            <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/5 space-y-2">
                              <span className="text-4xs uppercase tracking-widest text-accent font-bold block">
                                {comp.roleA} Exclusive Routes ({comp.roleAExclusiveRoutes?.length || 0})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(comp.roleAExclusiveRoutes || []).map((r: string, rIdx: number) => (
                                  <span key={rIdx} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-mono">
                                    {r}
                                  </span>
                                ))}
                                {(!comp.roleAExclusiveRoutes || comp.roleAExclusiveRoutes.length === 0) && (
                                  <span className="text-4xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </div>

                            {/* Common Shared */}
                            <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/5 space-y-2">
                              <span className="text-4xs uppercase tracking-widest text-muted-foreground font-bold block">
                                Shared Common Routes ({comp.commonRoutes?.length || 0})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(comp.commonRoutes || []).map((r: string, rIdx: number) => (
                                  <span key={rIdx} className="px-2 py-0.5 rounded bg-zinc-800 text-muted-foreground text-[10px] font-mono">
                                    {r}
                                  </span>
                                ))}
                                {(!comp.commonRoutes || comp.commonRoutes.length === 0) && (
                                  <span className="text-4xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </div>

                            {/* Role B Exclusive */}
                            <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/5 space-y-2">
                              <span className="text-4xs uppercase tracking-widest text-muted-foreground font-bold block">
                                {comp.roleB} Exclusive Routes ({comp.roleBExclusiveRoutes?.length || 0})
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {(comp.roleBExclusiveRoutes || []).map((r: string, rIdx: number) => (
                                  <span key={rIdx} className="px-2 py-0.5 rounded bg-zinc-800 text-muted-foreground text-[10px] font-mono">
                                    {r}
                                  </span>
                                ))}
                                {(!comp.roleBExclusiveRoutes || comp.roleBExclusiveRoutes.length === 0) && (
                                  <span className="text-4xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: API QA */}
        <TabsContent value="api">
          <div className="mt-4 space-y-6">
            {apiEndpoints.length === 0 && apiResponses.length === 0 ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Discovering and testing API endpoints in background...'
                  : 'No API endpoints discovered or tested for this run.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. API QA Metric Cards */}
                <Grid cols={1} colsSm={2} colsLg={6} gap={12}>
                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Discovered Endpoints
                    </span>
                    <span className="text-xl font-bold text-foreground font-mono">
                      {apiEndpoints.length}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Tested Endpoints
                    </span>
                    <span className="text-xl font-bold text-accent font-mono">
                      {apiCoverage?.endpointsTested ?? apiResponses.length}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Safe Methods Tested
                    </span>
                    <span className="text-xl font-bold text-success font-mono">
                      {apiCoverage?.safeMethodsTested ?? 0}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Auth Checks
                    </span>
                    <span className="text-xl font-bold text-sky-400 font-mono">
                      {apiCoverage?.authorizationChecks ?? 0}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      API Coverage
                    </span>
                    <span className="text-xl font-bold text-foreground font-mono">
                      {apiCoverage ? `${(apiCoverage.coverageRatio * 100).toFixed(0)}%` : 'N/A'}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      API Failures
                    </span>
                    <span
                      className={`text-xl font-bold font-mono ${
                        apiFailures.length > 0 ? 'text-danger' : 'text-success'
                      }`}
                    >
                      {apiFailures.length}
                    </span>
                  </div>
                </Grid>

                {/* 2. Critical API Security & Failure Banner */}
                {apiFailures.length > 0 && (
                  <div className="border border-danger/40 bg-danger/10 rounded-2xl p-6 font-mono text-xs shadow-glass space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-danger/20 border border-danger/30 flex items-center justify-center text-danger font-bold text-sm animate-pulse">
                        !
                      </div>
                      <div>
                        <span className="font-bold text-danger text-sm block">
                          API Quality & Security Defects Detected ({apiFailures.length})
                        </span>
                        <p className="text-muted-foreground text-3xs mt-0.5">
                          Deterministic assertions detected API failures, unexpected 5xx responses, contract mismatches, or unauthorized access.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-danger/20">
                      {apiFailures.map((f: any, fIdx: number) => (
                        <div
                          key={fIdx}
                          className="px-2.5 py-1 rounded bg-danger/20 border border-danger/30 text-danger text-3xs flex items-center gap-2"
                        >
                          <span className="font-bold">{f.bugType || 'API_FAILURE'}</span>
                          <span className="text-foreground/80 font-mono">{f.method} {f.url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Discovered & Tested Endpoints Table */}
                {apiEndpoints.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Discovered API Endpoints ({apiEndpoints.length})
                    </h3>
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-3xs font-mono">
                        <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                          <tr>
                            <th className="p-3 font-semibold">Method</th>
                            <th className="p-3 font-semibold">Endpoint Path</th>
                            <th className="p-3 font-semibold">Discovery Source</th>
                            <th className="p-3 font-semibold">Safety Policy</th>
                            <th className="p-3 font-semibold">Observed Status</th>
                            <th className="p-3 font-semibold">Latency</th>
                            <th className="p-3 font-semibold">Verdict</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-zinc-950/40">
                          {apiEndpoints.map((ep: any, eIdx: number) => {
                            const matchingResult = apiResponses.find((r: any) => r.endpointId === ep.id);
                            const methodUpper = ep.method?.toUpperCase() || 'GET';
                            const isGet = methodUpper === 'GET' || methodUpper === 'HEAD' || methodUpper === 'OPTIONS';
                            const isPost = methodUpper === 'POST';
                            const isDelete = methodUpper === 'DELETE';
                            const isPassed = matchingResult ? matchingResult.status === 'PASSED' : false;
                            const isFailed = matchingResult ? matchingResult.status === 'FAILED' : false;

                            return (
                              <tr key={eIdx} className="hover:bg-white/5">
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                      isGet
                                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                        : isPost
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : isDelete
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {methodUpper}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="text-foreground font-semibold block">{ep.path}</span>
                                  {ep.summary && (
                                    <span className="text-muted-foreground text-4xs block truncate max-w-sm">
                                      {ep.summary}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-muted-foreground text-4xs">
                                    {ep.source}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {ep.requiresExplicitSafeConfig ? (
                                    <span className="text-amber-400 text-4xs font-semibold">
                                      Requires Safe Config
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 text-4xs font-semibold">
                                      Safe Auto-Execute
                                    </span>
                                  )}
                                </td>
                                <td className="p-3">
                                  {matchingResult?.observation ? (
                                    <span
                                      className={`font-bold ${
                                        matchingResult.observation.status >= 500
                                          ? 'text-danger'
                                          : matchingResult.observation.status >= 400
                                          ? 'text-warning'
                                          : 'text-success'
                                      }`}
                                    >
                                      HTTP {matchingResult.observation.status}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-4xs">Not Executed</span>
                                  )}
                                </td>
                                <td className="p-3 text-muted-foreground">
                                  {matchingResult?.durationMs !== undefined
                                    ? `${matchingResult.durationMs}ms`
                                    : '—'}
                                </td>
                                <td className="p-3">
                                  {matchingResult ? (
                                    <span
                                      className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                        isFailed
                                          ? 'bg-danger/20 text-danger border border-danger/30'
                                          : isPassed
                                          ? 'bg-success/20 text-success border border-success/30'
                                          : 'bg-zinc-800 text-muted-foreground'
                                      }`}
                                    >
                                      {matchingResult.status}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-muted-foreground text-4xs uppercase">
                                      PENDING
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. API Failures & Reproductions Detail */}
                {apiFailures.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      API Failures & Diagnostic Telemetry ({apiFailures.length})
                    </h3>
                    <div className="space-y-3">
                      {apiFailures.map((fail: any, fIdx: number) => (
                        <div
                          key={fIdx}
                          className="border border-danger/30 bg-zinc-900/40 p-4 rounded-xl space-y-3 font-mono text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-danger/20 text-danger border border-danger/30 text-3xs font-bold">
                                {fail.bugType || 'API_FAILURE'}
                              </span>
                              <span className="text-foreground font-bold">
                                {fail.method} {fail.url}
                              </span>
                            </div>
                            <span className="text-3xs text-muted-foreground">
                              HTTP {fail.observation?.status || 0} ({fail.durationMs || 0}ms)
                            </span>
                          </div>

                          <div className="text-3xs text-muted-foreground">
                            <span className="text-danger block mb-1">
                              <strong>Error:</strong> {fail.errorMessage || 'Assertion failure'}
                            </span>
                            {fail.observation?.bodyExcerpt && (
                              <div className="mt-2 p-2 bg-zinc-950 rounded border border-white/5 font-mono text-4xs text-foreground/80 overflow-x-auto">
                                <strong>Response Excerpt:</strong> {fail.observation.bodyExcerpt}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Security & Authorization QA */}
        <TabsContent value="security">
          <div className="mt-4 space-y-6">
            {securityFindings.length === 0 && !securityCoverage ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Executing deterministic security and authorization scans in background...'
                  : 'No security findings or weak configurations detected for this test run.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Security QA Metric Cards */}
                <Grid cols={1} colsSm={2} colsLg={6} gap={12}>
                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Targets Discovered
                    </span>
                    <span className="text-xl font-bold text-foreground font-mono">
                      {securityCoverage?.targetsDiscovered ?? 0}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Checks Executed
                    </span>
                    <span className="text-xl font-bold text-accent font-mono">
                      {securityCoverage?.checksExecuted ?? 0}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Critical Weaknesses
                    </span>
                    <span
                      className={`text-xl font-bold font-mono ${
                        criticalSecurityFindings.length > 0 ? 'text-rose-500' : 'text-success'
                      }`}
                    >
                      {criticalSecurityFindings.length}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      High Weaknesses
                    </span>
                    <span
                      className={`text-xl font-bold font-mono ${
                        highSecurityFindings.length > 0 ? 'text-amber-500' : 'text-success'
                      }`}
                    >
                      {highSecurityFindings.length}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Medium Weaknesses
                    </span>
                    <span
                      className={`text-xl font-bold font-mono ${
                        mediumSecurityFindings.length > 0 ? 'text-yellow-400' : 'text-muted-foreground'
                      }`}
                    >
                      {mediumSecurityFindings.length}
                    </span>
                  </div>

                  <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                    <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                      Security Coverage
                    </span>
                    <span className="text-xl font-bold text-foreground font-mono">
                      {securityCoverage ? `${(securityCoverage.coverageRatio * 100).toFixed(0)}%` : '100%'}
                    </span>
                  </div>
                </Grid>

                {/* 2. Critical Security Alert Banner */}
                {(criticalSecurityFindings.length > 0 || highSecurityFindings.length > 0) && (
                  <div className="border border-danger/40 bg-danger/10 rounded-2xl p-6 font-mono text-xs shadow-glass space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-danger/20 border border-danger/30 flex items-center justify-center text-danger font-bold text-sm animate-pulse">
                        🛡️
                      </div>
                      <div>
                        <span className="font-bold text-danger text-sm block">
                          Security & Authorization Boundaries Violated ({criticalSecurityFindings.length + highSecurityFindings.length})
                        </span>
                        <p className="text-muted-foreground text-3xs mt-0.5">
                          Deterministic security checks detected authentication bypasses, privilege escalation risks, exposed secrets, or insecure transport policies.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-danger/20">
                      {[...criticalSecurityFindings, ...highSecurityFindings].map((f: any, fIdx: number) => (
                        <div
                          key={fIdx}
                          className="px-2.5 py-1 rounded bg-danger/20 border border-danger/30 text-danger text-3xs flex items-center gap-2"
                        >
                          <span className="font-bold">[{f.severity?.toUpperCase() || 'CRITICAL'}]</span>
                          <span className="text-foreground/80 font-mono">{f.title || f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Security Findings Table */}
                {securityFindings.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Detected Security Findings ({securityFindings.length})
                    </h3>
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-3xs font-mono">
                        <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                          <tr>
                            <th className="p-3 font-semibold">Severity</th>
                            <th className="p-3 font-semibold">Finding Type</th>
                            <th className="p-3 font-semibold">Target Route / URL</th>
                            <th className="p-3 font-semibold">Description</th>
                            <th className="p-3 font-semibold">Remediation Guidance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-zinc-950/40">
                          {securityFindings.map((finding: any, sIdx: number) => {
                            const sev = (finding.severity || 'medium').toLowerCase();
                            const isCrit = sev === 'critical';
                            const isHigh = sev === 'high';
                            const isMed = sev === 'medium';

                            return (
                              <tr key={sIdx} className="hover:bg-white/5">
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                      isCrit
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : isHigh
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : isMed
                                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                                    }`}
                                  >
                                    {sev}
                                  </span>
                                </td>
                                <td className="p-3 font-semibold text-foreground">
                                  {finding.type}
                                </td>
                                <td className="p-3 text-muted-foreground max-w-xs truncate">
                                  {finding.targetUrl || testRun.url || 'N/A'}
                                </td>
                                <td className="p-3 text-foreground/80 max-w-sm">
                                  {finding.description}
                                </td>
                                <td className="p-3 text-sky-400 max-w-xs">
                                  {finding.remediation || 'Apply standard defensive security controls.'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. Security Policy Safeguards & Defensive QA Scope */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 font-mono text-3xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-bold uppercase tracking-wider">
                    <span>🛡️ Defensive QA Scope & Safety Guarantees</span>
                  </div>
                  <p>
                    Sculra operates strictly as a defensive QA platform with bounded, non-destructive security assertions. All tests enforce strict zero-credential exposure, automated token and secret masking, and SSRF prevention guards across all targets.
                  </p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Performance & Reliability QA */}
        <TabsContent value="performance">
          <div className="mt-4 space-y-6">
            {performanceFindings.length === 0 && !performanceCoverage ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Measuring browser navigation timing, Core Web Vitals, API latencies, and multi-run reliability...'
                  : 'No performance regressions or threshold violations detected for this test run.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Performance QA Metric Cards */}
                {(() => {
                  const perfScore = formatPerformanceScore(performanceCoverage?.performanceScore);
                  return (
                    <Grid cols={1} colsSm={2} colsLg={6} gap={12}>
                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Performance Score
                        </span>
                        <span className={`text-xl font-bold font-mono ${perfScore.colorClass}`}>
                          {perfScore.text}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Targets Evaluated
                        </span>
                        <span className="text-xl font-bold text-foreground font-mono">
                          {formatTargetsEvaluated(performanceCoverage?.targetsTested, performanceCoverage?.targetsDiscovered)}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Total Measurements
                        </span>
                        <span className="text-xl font-bold text-accent font-mono">
                          {formatPerformanceMetric(performanceCoverage?.totalMeasurements)}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Regressions
                        </span>
                        <span
                          className={`text-xl font-bold font-mono ${
                            perfRegressions.length > 0
                              ? 'text-rose-500'
                              : typeof performanceCoverage?.regressionsCount === 'number'
                              ? 'text-success'
                              : performanceFindings.length > 0
                              ? 'text-success'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {perfRegressions.length > 0
                            ? perfRegressions.length
                            : typeof performanceCoverage?.regressionsCount === 'number'
                            ? performanceCoverage.regressionsCount
                            : performanceFindings.length > 0
                            ? 0
                            : '--'}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Critical / High Issues
                        </span>
                        <span
                          className={`text-xl font-bold font-mono ${
                            criticalPerfFindings.length + highPerfFindings.length > 0
                              ? 'text-rose-500'
                              : performanceCoverage || performanceFindings.length > 0
                              ? 'text-success'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {performanceCoverage || performanceFindings.length > 0
                            ? criticalPerfFindings.length + highPerfFindings.length
                            : '--'}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Audit Duration
                        </span>
                        <span className="text-xl font-bold text-foreground font-mono">
                          {typeof performanceCoverage?.durationMs === 'number' ? `${(performanceCoverage.durationMs / 1000).toFixed(1)}s` : '--'}
                        </span>
                      </div>
                    </Grid>
                  );
                })()}

                {/* 2. Critical Performance Alert Banner */}
                {(criticalPerfFindings.length > 0 || highPerfFindings.length > 0) && (
                  <div className="border border-danger/40 bg-danger/10 rounded-2xl p-6 font-mono text-xs shadow-glass space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-danger/20 border border-danger/30 flex items-center justify-center text-danger font-bold text-sm animate-pulse">
                        ⚡
                      </div>
                      <div>
                        <span className="font-bold text-danger text-sm block">
                          Performance & Reliability Defects Detected ({criticalPerfFindings.length + highPerfFindings.length})
                        </span>
                        <p className="text-muted-foreground text-3xs mt-0.5">
                          Measured browser navigation timing, Core Web Vitals, API response latency, or multi-run reliability exceeded acceptable thresholds.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-danger/20">
                      {[...criticalPerfFindings, ...highPerfFindings].map((f: any, fIdx: number) => (
                        <div
                          key={fIdx}
                          className="px-2.5 py-1 rounded bg-danger/20 border border-danger/30 text-danger text-3xs flex items-center gap-2"
                        >
                          <span className="font-bold">[{f.severity?.toUpperCase() || 'HIGH'}]</span>
                          <span className="text-foreground/80 font-mono">{f.title || f.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Performance Findings Table */}
                {performanceFindings.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Performance Findings & Latency Anomalies ({performanceFindings.length})
                    </h3>
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-3xs font-mono">
                        <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                          <tr>
                            <th className="p-3 font-semibold">Severity</th>
                            <th className="p-3 font-semibold">Finding Type</th>
                            <th className="p-3 font-semibold">Target Route / URL</th>
                            <th className="p-3 font-semibold">Observed Value</th>
                            <th className="p-3 font-semibold">Policy Threshold</th>
                            <th className="p-3 font-semibold">Description</th>
                            <th className="p-3 font-semibold">Remediation Guidance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-zinc-950/40">
                          {performanceFindings.map((finding: any, pIdx: number) => {
                            const sev = (finding.severity || 'medium').toLowerCase();
                            const isCrit = sev === 'critical';
                            const isHigh = sev === 'high';
                            const isMed = sev === 'medium';

                            return (
                              <tr key={pIdx} className="hover:bg-white/5">
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                      isCrit
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : isHigh
                                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        : isMed
                                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                        : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'
                                    }`}
                                  >
                                    {sev}
                                  </span>
                                </td>
                                <td className="p-3 font-semibold text-foreground">
                                  {finding.type}
                                </td>
                                <td className="p-3 text-muted-foreground max-w-xs truncate">
                                  {finding.targetUrl || testRun.url || 'N/A'}
                                </td>
                                <td className="p-3 font-bold text-amber-400 font-mono">
                                  {finding.observedValue || 'N/A'}
                                </td>
                                <td className="p-3 text-muted-foreground font-mono">
                                  {finding.thresholdValue || 'N/A'}
                                </td>
                                <td className="p-3 text-foreground/80 max-w-sm">
                                  {finding.summary || finding.description}
                                </td>
                                <td className="p-3 text-sky-400 max-w-xs">
                                  {finding.remediationRecommendation || finding.remediation || 'Optimize resource bundles and backend latency.'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. Performance QA Scope & Safe Non-Destructive Boundaries */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 font-mono text-3xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-bold uppercase tracking-wider">
                    <span>⚡ Deterministic Performance QA Guarantees</span>
                  </div>
                  <p>
                    Sculra measures real browser navigation timings, Core Web Vitals (LCP, CLS, INP, FCP), asset weight, single-session safe action latencies, and API responsiveness under authentic QA conditions. All measurements prohibit synthetic load generation, flood testing, and metric fabrication, ensuring zero credential leakage across telemetry.
                  </p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: Accessibility & Inclusive UX QA */}
        <TabsContent value="accessibility">
          <div className="mt-4 space-y-6">
            {accessibilityFindings.length === 0 && !accessibilityCoverage ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground font-mono">
                {testRun.status === 'queued' || testRun.status === 'running'
                  ? 'Executing deterministic accessibility and inclusive UX scans across WCAG principles in background...'
                  : 'No accessibility findings or WCAG violations detected for this test run.'}
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Accessibility QA Metric Cards */}
                {(() => {
                  const scoreDisplay = formatAccessibilityScore(accessibilityCoverage?.accessibilityScore);
                  const scoreColor = getAccessibilityScoreColor(accessibilityCoverage?.accessibilityScore);
                  return (
                    <Grid cols={1} colsSm={2} colsLg={6} gap={12}>
                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Accessibility Score
                        </span>
                        <span className={`text-xl font-bold font-mono ${scoreColor}`}>
                          {scoreDisplay}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Targets Evaluated
                        </span>
                        <span className="text-xl font-bold text-foreground font-mono">
                          {accessibilityCoverage
                            ? `${accessibilityCoverage.targetsTested}/${accessibilityCoverage.targetsDiscovered}`
                            : '--'}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Total Checks
                        </span>
                        <span className="text-xl font-bold text-accent font-mono">
                          {accessibilityCoverage?.totalChecks ?? 0}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Critical Violations
                        </span>
                        <span
                          className={`text-xl font-bold font-mono ${
                            criticalA11yFindings.length > 0 ? 'text-rose-500' : 'text-success'
                          }`}
                        >
                          {criticalA11yFindings.length}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          High Severity
                        </span>
                        <span
                          className={`text-xl font-bold font-mono ${
                            highA11yFindings.length > 0 ? 'text-amber-500' : 'text-success'
                          }`}
                        >
                          {highA11yFindings.length}
                        </span>
                      </div>

                      <div className="bg-zinc-900/30 border border-white/5 p-4 rounded-xl">
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1 font-mono">
                          Viewports Evaluated
                        </span>
                        <span className="text-xl font-bold text-foreground font-mono">
                          {accessibilityCoverage?.viewportsTested?.length
                            ? `${accessibilityCoverage.viewportsTested.length} profiles`
                            : '3 profiles'}
                        </span>
                      </div>
                    </Grid>
                  );
                })()}

                {/* 2. Critical Accessibility Alert Banner */}
                {(criticalA11yFindings.length > 0 || highA11yFindings.length > 0) && (
                  <div className="border border-danger/40 bg-danger/10 rounded-2xl p-6 font-mono text-xs shadow-glass space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-danger/20 border border-danger/30 flex items-center justify-center text-danger font-bold text-sm animate-pulse">
                        ♿
                      </div>
                      <div>
                        <span className="font-bold text-danger text-sm block">
                          Accessibility & Inclusive UX Defects Detected ({criticalA11yFindings.length + highA11yFindings.length})
                        </span>
                        <p className="text-muted-foreground text-3xs mt-0.5">
                          Deterministic checks detected keyboard navigation traps, missing accessible names on interactive elements, severe text contrast failures, or broken dialog focus containment.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-danger/20">
                      {[...criticalA11yFindings, ...highA11yFindings].map((f: any, fIdx: number) => {
                        const badge = getAccessibilitySeverityBadge(f.severity);
                        return (
                          <div
                            key={fIdx}
                            className={`px-2.5 py-1 rounded border text-3xs flex items-center gap-2 ${badge.bg} ${badge.border} ${badge.text}`}
                          >
                            <span className="font-bold">[{badge.label}]</span>
                            <span className="text-foreground/80 font-mono">
                              {f.criterion ? `${f.criterion} · ` : ''}{f.summary || f.type}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. WCAG Principles Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-3xs">
                  <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider">1. Perceivable</span>
                      <span className="text-muted-foreground">
                        {accessibilityFindings.filter((f) => f.wcagPrinciple === 'perceivable' || f.category === 'contrast' || f.category === 'images' || f.category === 'text_scaling').length} issue(s)
                      </span>
                    </div>
                    <p className="text-muted-foreground text-4xs">Contrast, Alt Text, 200% Text Scaling Reflow, Motion</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider">2. Operable</span>
                      <span className="text-muted-foreground">
                        {accessibilityFindings.filter((f) => f.wcagPrinciple === 'operable' || f.category === 'keyboard' || f.category === 'focus' || f.category === 'touch_targets' || f.category === 'dialogs').length} issue(s)
                      </span>
                    </div>
                    <p className="text-muted-foreground text-4xs">Keyboard Navigation, Focus Traps, Touch Targets, Dialogs</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider">3. Understandable</span>
                      <span className="text-muted-foreground">
                        {accessibilityFindings.filter((f) => f.wcagPrinciple === 'understandable' || f.category === 'forms' || f.category === 'errors').length} issue(s)
                      </span>
                    </div>
                    <p className="text-muted-foreground text-4xs">Form Labels, Instructions, Error Announcements, Page Language</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/30 border border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider">4. Robust</span>
                      <span className="text-muted-foreground">
                        {accessibilityFindings.filter((f) => f.wcagPrinciple === 'robust' || f.category === 'aria' || f.category === 'semantics' || f.category === 'headings' || f.category === 'landmarks').length} issue(s)
                      </span>
                    </div>
                    <p className="text-muted-foreground text-4xs">ARIA Roles & States, Headings Hierarchy, Landmark Regions</p>
                  </div>
                </div>

                {/* 4. Accessibility Findings Table */}
                {accessibilityFindings.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Accessibility & Inclusive UX Findings ({accessibilityFindings.length})
                    </h3>
                    <div className="border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-3xs font-mono">
                        <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                          <tr>
                            <th className="p-3 font-semibold">Severity</th>
                            <th className="p-3 font-semibold">WCAG Criterion</th>
                            <th className="p-3 font-semibold">Category</th>
                            <th className="p-3 font-semibold">Target / Selector</th>
                            <th className="p-3 font-semibold">Observed Defect</th>
                            <th className="p-3 font-semibold">Expected Behavior</th>
                            <th className="p-3 font-semibold">Remediation Guidance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-zinc-950/40">
                          {accessibilityFindings.map((finding: any, aIdx: number) => {
                            const badge = getAccessibilitySeverityBadge(finding.severity);
                            return (
                              <tr key={aIdx} className="hover:bg-white/5">
                                <td className="p-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-4xs font-bold uppercase border ${badge.bg} ${badge.text} ${badge.border}`}
                                  >
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="p-3 font-semibold text-foreground">
                                  {finding.criterion || finding.type}
                                </td>
                                <td className="p-3 text-muted-foreground uppercase">
                                  {finding.category || 'General'}
                                </td>
                                <td className="p-3 text-muted-foreground max-w-xs truncate font-mono">
                                  {finding.selector || finding.targetUrl || finding.metadata?.selector || 'N/A'}
                                </td>
                                <td className="p-3 text-rose-300 max-w-sm">
                                  {finding.summary || finding.details || finding.description}
                                </td>
                                <td className="p-3 text-muted-foreground max-w-sm">
                                  {finding.expectedBehavior || 'Element should comply with WCAG accessibility guidelines.'}
                                </td>
                                <td className="p-3 text-sky-400 max-w-xs">
                                  {finding.remediationGuidance || finding.remediation || 'Add missing attributes or adjust contrast/focus management.'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 5. Accessibility QA Guarantees & Non-Destructive Principles */}
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 font-mono text-3xs text-muted-foreground space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-bold uppercase tracking-wider">
                    <span>♿ Deterministic Accessibility & Inclusive UX Guarantees</span>
                  </div>
                  <p>
                    Sculra evaluates real browser accessibility trees across the 4 WCAG Principles (Perceivable, Operable, Understandable, Robust). Evaluation includes deterministic keyboard trap detection, tab order sequence, focus visibility, touch target dimensions across responsive viewports (Desktop, Tablet, Mobile), 200% text reflow clipping verification, color contrast ratios, semantic landmarks, heading hierarchies, form field labeling, and dialog focus containment. All metrics are truthfully grounded with zero synthetic fabrication.
                  </p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: User Journeys */}
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

        {/* Tab 7: Responsive QA */}
        <TabsContent value="responsive">
          <div className="mt-4 space-y-6 font-mono">
            {/* Viewport Matrix Grid */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                Evaluated Viewport Matrix
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-zinc-900/30 border border-white/10 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Desktop Profile</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-muted-foreground">1440 × 900</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Full widescreen desktop layout</p>
                </div>
                <div className="p-4 bg-zinc-900/30 border border-white/10 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Tablet Profile</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-muted-foreground">768 × 1024</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Medium touchscreen portrait layout</p>
                </div>
                <div className="p-4 bg-zinc-900/30 border border-white/10 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Mobile Profile</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-accent/20 text-accent font-bold">390 × 844</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Compact mobile smartphone viewport</p>
                </div>
              </div>
            </div>

            {/* Responsive Observations */}
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                Responsive Layout Observations ({responsiveObservations.length})
              </h3>
              {responsiveObservations.length === 0 ? (
                <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground">
                  ✓ All pages rendered cleanly across desktop, tablet, and mobile viewports with zero horizontal overflow or element clipping.
                </div>
              ) : (
                <div className="space-y-3">
                  {responsiveObservations.map((obs) => {
                    const data = obs.metadata?.observation || {};
                    const isHigh = data.severity === 'high' || data.severity === 'critical';
                    return (
                      <div
                        key={obs.id}
                        className={`p-4 border rounded-xl space-y-2 text-xs ${
                          isHigh
                            ? 'border-danger/30 bg-danger/5'
                            : 'border-warning/20 bg-warning/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isHigh ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                              }`}
                            >
                              {data.type || 'RESPONSIVE_DEFECT'}
                            </span>
                            {data.viewport?.name && (
                              <span className="px-2 py-0.5 rounded bg-white/10 text-muted-foreground text-[10px] uppercase">
                                {data.viewport.name} ({data.viewport.width}px)
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground text-[10px]">
                            {data.severity ? data.severity.toUpperCase() : 'MEDIUM'}
                          </span>
                        </div>
                        <p className="text-foreground font-semibold">{obs.message || obs.title}</p>
                        {data.selector && (
                          <p className="text-muted-foreground text-[11px]">
                            Element: <code className="bg-black/30 px-1 py-0.5 rounded text-accent">{data.selector}</code>
                          </p>
                        )}
                        {data.overflowAmount && (
                          <p className="text-muted-foreground text-[10px]">
                            Overflow: {data.overflowAmount}px beyond viewport boundary
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 8: Visual QA */}
        <TabsContent value="visual">
          <div className="mt-4 space-y-6 font-mono">
            <div>
              <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                Visual Baseline Comparisons ({visualComparisons.length})
              </h3>
              {visualComparisons.length === 0 ? (
                <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground">
                  No visual regression snapshots available for this test run.
                </div>
              ) : (
                <div className="space-y-3">
                  {visualComparisons.map((comp) => {
                    const data = comp.metadata?.comparison || {};
                    const status = data.status || 'PASS';
                    const isPassed = status === 'PASS';
                    const isMissing = status === 'BASELINE_MISSING';
                    const isHigh = status === 'HIGH';

                    return (
                      <div
                        key={comp.id}
                        className={`p-4 border rounded-xl space-y-2 text-xs ${
                          isPassed
                            ? 'border-success/20 bg-success/5'
                            : isMissing
                            ? 'border-white/10 bg-zinc-900/30'
                            : isHigh
                            ? 'border-danger/30 bg-danger/5'
                            : 'border-warning/20 bg-warning/5'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                isPassed
                                  ? 'bg-success/20 text-success'
                                  : isMissing
                                  ? 'bg-white/10 text-muted-foreground'
                                  : isHigh
                                  ? 'bg-danger/20 text-danger'
                                  : 'bg-warning/20 text-warning'
                              }`}
                            >
                              {status}
                            </span>
                            {data.viewport?.name && (
                              <span className="px-2 py-0.5 rounded bg-white/10 text-muted-foreground text-[10px] uppercase">
                                Viewport: {data.viewport.name} ({data.viewport.width}×{data.viewport.height})
                              </span>
                            )}
                          </div>
                          <span className="text-muted-foreground text-[10px]">
                            {data.threshold ? `Threshold: ${(data.threshold * 100).toFixed(1)}%` : ''}
                          </span>
                        </div>
                        <p className="text-foreground font-semibold">{comp.message || comp.title}</p>
                        <p className="text-muted-foreground text-[11px] truncate">URL: {comp.url}</p>
                        {data.boundingRegion && (
                          <p className="text-muted-foreground text-[10px]">
                            Diff Region: x={data.boundingRegion.x}, y={data.boundingRegion.y}, w={data.boundingRegion.width}, h={data.boundingRegion.height}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Product Model & Business Workflows */}
        <TabsContent value="product">
          <div className="space-y-6 font-mono">
            {/* Header Banner */}
            <div className="border border-accent/20 bg-accent/5 rounded-2xl p-5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground uppercase tracking-wider text-xs">
                    Product Understanding & Business Workflows
                  </span>
                  {productModel?.applicationProfile && (
                    <span className="px-2.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent text-[10px] uppercase font-bold">
                      Category: {productModel.applicationProfile.primaryType}
                    </span>
                  )}
                  {productModel?.applicationProfile?.authenticationPresent && (
                    <span className="px-2 py-0.5 rounded bg-success/10 border border-success/20 text-success text-[10px] uppercase font-bold">
                      Auth Gateway
                    </span>
                  )}
                  {productModel?.applicationProfile?.multiRoleSignals && (
                    <span className="px-2 py-0.5 rounded bg-white/10 border border-white/10 text-muted-foreground text-[10px] uppercase">
                      Multi-Role Signals
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-3xs max-w-2xl">
                  Understands application architecture as a product: maps user roles, feature capabilities, and business-critical workflows grounded in deterministic evidence.
                </p>
              </div>
              {productModel?.applicationProfile && (
                <div className="text-right">
                  <span className="text-3xs uppercase tracking-widest text-muted-foreground block">Classification Confidence</span>
                  <span className="text-sm font-bold text-accent font-mono">
                    {(productModel.applicationProfile.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {!productModel ? (
              <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center text-xs text-muted-foreground">
                Product understanding analysis has not yet completed for this test run.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Product Coverage KPI Strip */}
                {productModel.coverage && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Product Model QA Coverage
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                        <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Features Covered</span>
                        <span className="text-lg font-bold text-foreground">
                          {productModel.coverage.testedFeatures} / {productModel.coverage.totalFeatures}
                        </span>
                        <span className="text-4xs text-muted-foreground block mt-1">
                          {((productModel.coverage.featureCoverageRatio || 0) * 100).toFixed(0)}% capability coverage
                        </span>
                      </div>
                      <div className="bg-zinc-900/40 border border-accent/20 rounded-xl p-4 text-center">
                        <span className="text-3xs uppercase tracking-wider text-accent block">Workflows Tested</span>
                        <span className="text-lg font-bold text-accent">
                          {productModel.coverage.testedWorkflows} / {productModel.coverage.totalWorkflows}
                        </span>
                        <span className="text-4xs text-muted-foreground block mt-1">
                          {productModel.coverage.partiallyTestedWorkflows} partially tested
                        </span>
                      </div>
                      <div className="bg-zinc-900/40 border border-warning/20 rounded-xl p-4 text-center">
                        <span className="text-3xs uppercase tracking-wider text-warning block">High-Criticality Paths</span>
                        <span className="text-lg font-bold text-warning">
                          {productModel.coverage.highCriticalityWorkflowsTested} / {productModel.coverage.highCriticalityWorkflowsTotal}
                        </span>
                        <span className="text-4xs text-muted-foreground block mt-1">
                          {productModel.coverage.highCriticalityWorkflowsUntested} untested critical paths
                        </span>
                      </div>
                      <div className="bg-zinc-900/40 border border-success/20 rounded-xl p-4 text-center">
                        <span className="text-3xs uppercase tracking-wider text-success block">User Roles Tested</span>
                        <span className="text-lg font-bold text-success">
                          {productModel.coverage.rolesWithTestedWorkflows} / {productModel.coverage.totalRoles}
                        </span>
                        <span className="text-4xs text-muted-foreground block mt-1">
                          {productModel.roles.map((r: any) => r.name).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Business-Critical Workflows */}
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                    Discovered Business-Critical Workflows ({productModel.workflows.length})
                  </h3>
                  <div className="space-y-4">
                    {productModel.workflows.map((wf: any) => {
                      const isCritical = wf.criticality.level === 'CRITICAL';
                      const isHigh = wf.criticality.level === 'HIGH';
                      const isPassed = wf.executionStatus === 'TESTED';
                      const isFailed = wf.executionStatus === 'FAILED';

                      return (
                        <div
                          key={wf.id}
                          className={`p-4 rounded-xl border space-y-3 ${
                            isFailed
                              ? 'bg-danger/5 border-danger/30'
                              : isPassed
                              ? 'bg-zinc-950/40 border-success/20'
                              : isCritical
                              ? 'bg-danger/5 border-danger/20'
                              : 'bg-zinc-950/40 border-white/10'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-foreground">{wf.name}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                    isCritical
                                      ? 'bg-danger/20 text-danger border border-danger/30'
                                      : isHigh
                                      ? 'bg-warning/20 text-warning border border-warning/30'
                                      : 'bg-accent/10 text-accent border border-accent/20'
                                  }`}
                                >
                                  {wf.criticality.level} ({wf.criticality.score}/100)
                                </span>
                                <span className="px-2 py-0.5 rounded bg-white/5 text-muted-foreground text-[10px]">
                                  Role: {wf.roleName || 'User'}
                                </span>
                              </div>
                              <p className="text-3xs text-muted-foreground">{wf.goal}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${
                                  isPassed
                                    ? 'bg-success/20 text-success border border-success/30'
                                    : isFailed
                                    ? 'bg-danger/20 text-danger border border-danger/30'
                                    : wf.executionStatus === 'PARTIALLY_TESTED'
                                    ? 'bg-warning/20 text-warning border border-warning/30'
                                    : 'bg-white/5 text-muted-foreground border border-white/10'
                                }`}
                              >
                                {wf.executionStatus}
                              </span>
                            </div>
                          </div>

                          {/* Criticality Rationale */}
                          {wf.criticality.reasons && wf.criticality.reasons.length > 0 && (
                            <div className="text-4xs text-muted-foreground space-y-1 bg-white/[0.02] p-2.5 rounded-lg">
                              <span className="font-bold text-accent uppercase tracking-wider block">Business Criticality Rationale:</span>
                              <ul className="list-disc list-inside space-y-0.5">
                                {wf.criticality.reasons.map((r: string, rIdx: number) => (
                                  <li key={rIdx}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Workflow Step Sequence */}
                          {wf.steps && wf.steps.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-4xs uppercase tracking-widest text-muted-foreground font-bold block">
                                Workflow Step Sequence ({wf.steps.length} Steps)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {wf.steps.map((step: any, sIdx: number) => (
                                  <div key={sIdx} className="p-2.5 bg-zinc-900/60 rounded-lg border border-white/5 text-3xs space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-4xs font-bold text-accent">Step {step.stepNumber}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground text-4xs uppercase font-bold">
                                        {step.actionType}
                                      </span>
                                    </div>
                                    <p className="text-foreground font-semibold truncate">{step.targetDescription || step.expectedTransition}</p>
                                    <span className="text-muted-foreground text-4xs truncate block">{step.pageUrl}</span>
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

                {/* Features & Capabilities Table */}
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                    Discovered Product Capabilities & Features ({productModel.features.length})
                  </h3>
                  <div className="border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-3xs">
                      <thead className="bg-white/5 text-muted-foreground border-b border-white/10">
                        <tr>
                          <th className="p-3 font-semibold">Feature Capability</th>
                          <th className="p-3 font-semibold">Category</th>
                          <th className="p-3 font-semibold">Associated Routes</th>
                          <th className="p-3 font-semibold">Criticality</th>
                          <th className="p-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 bg-zinc-950/40">
                        {productModel.features.map((feat: any) => (
                          <tr key={feat.id} className="hover:bg-white/5">
                            <td className="p-3">
                              <span className="text-foreground font-bold block">{feat.name}</span>
                              <span className="text-muted-foreground text-4xs">{feat.description}</span>
                            </td>
                            <td className="p-3 text-muted-foreground">{feat.category || 'General'}</td>
                            <td className="p-3 text-muted-foreground truncate max-w-xs font-mono">
                              {feat.relatedRoutes?.join(', ') || feat.relatedPages?.join(', ')}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                  feat.criticality.level === 'CRITICAL'
                                    ? 'bg-danger/20 text-danger'
                                    : feat.criticality.level === 'HIGH'
                                    ? 'bg-warning/20 text-warning'
                                    : 'bg-accent/10 text-accent'
                                }`}
                              >
                                {feat.criticality.level} ({feat.criticality.score})
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-white/10 text-muted-foreground text-4xs uppercase">
                                {feat.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Discovered User Roles */}
                {productModel.roles.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                      Inferred User Roles ({productModel.roles.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {productModel.roles.map((role: any) => (
                        <div key={role.id} className="p-4 bg-zinc-950/40 border border-white/10 rounded-xl space-y-2 text-3xs">
                          <div className="flex items-center justify-between">
                            <span className="text-foreground font-bold">{role.name}</span>
                            <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-4xs font-bold uppercase">
                              {role.status}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-4xs">
                            Confidence: {(role.confidence * 100).toFixed(0)}%
                          </p>
                          {role.observedCapabilities && role.observedCapabilities.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-4xs uppercase tracking-widest text-muted-foreground font-bold block">Capabilities:</span>
                              <ul className="list-disc list-inside text-4xs text-muted-foreground space-y-0.5">
                                {role.observedCapabilities.map((cap: string, cIdx: number) => (
                                  <li key={cIdx}>{cap}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: AI Strategy & Prioritization */}
        <TabsContent value="strategy">
          <div className="space-y-6 font-mono">
            {/* Strategy Mode Header Banner */}
            <div className="border border-accent/20 bg-accent/5 rounded-2xl p-5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-foreground uppercase tracking-wider text-xs">
                    Autonomous Test Strategy & Prioritization Engine
                  </span>
                  {strategyDecisions.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent text-[10px] uppercase font-bold">
                      Mode: {strategyDecisions[strategyDecisions.length - 1].mode}
                    </span>
                  )}
                  {strategyDecisions[strategyDecisions.length - 1]?.isFallback && (
                    <span className="px-2 py-0.5 rounded bg-warning/10 border border-warning/20 text-warning text-[10px] uppercase font-bold">
                      Deterministic Fallback
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-3xs max-w-2xl">
                  Evaluates application structure, failure telemetry, and coverage gaps to dynamically rank test targets and allocate testing budgets without human intervention.
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xs uppercase tracking-widest text-muted-foreground block">Strategy Iterations</span>
                <span className="text-sm font-bold text-foreground font-mono">
                  {strategyDecisions.length} Decisions Logged
                </span>
              </div>
            </div>

            {strategyDecisions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-mono text-xs border border-white/5 rounded-2xl bg-zinc-950/40">
                No autonomous strategy decisions recorded for this test run.
              </div>
            ) : (
              <div className="space-y-6">
                {strategyDecisions.map((decision: any, dIdx: number) => {
                  const selectedTarget = decision.selectedTargets?.[0];
                  return (
                    <div key={dIdx} className="border border-white/10 bg-zinc-950/50 rounded-2xl p-6 space-y-5">
                      {/* Decision Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-4 flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded bg-white/10 text-white font-bold text-xs">
                            Strategy Iteration {decision.iteration}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold uppercase">
                            {decision.mode}
                          </span>
                          <span className="text-3xs text-muted-foreground">
                            {decision.selectedTargets?.length || 0} Target(s) Selected
                          </span>
                        </div>
                        <div className="text-3xs text-muted-foreground">
                          Budget Remaining: {decision.budgetRemaining?.targets ?? '--'} targets · {decision.budgetRemaining?.iterations ?? '--'} iters
                        </div>
                      </div>

                      {/* Selected Top Target & "Why This Was Tested" */}
                      {selectedTarget && (
                        <div className="p-4 rounded-xl bg-zinc-900/60 border border-accent/20 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-3xs font-bold text-accent uppercase tracking-wider">
                                Current Selected Target:
                              </span>
                              <span className="px-2 py-0.5 rounded bg-accent/20 text-accent font-mono text-[10px] font-bold">
                                {selectedTarget.targetType}
                              </span>
                              <span className="text-xs font-bold text-foreground">{selectedTarget.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-3xs text-muted-foreground">Deterministic Priority:</span>
                              <span className="px-2.5 py-0.5 rounded bg-accent/15 border border-accent/30 text-accent font-bold text-xs">
                                {selectedTarget.priorityScore} / 100
                              </span>
                            </div>
                          </div>

                          <div className="text-3xs text-muted-foreground font-mono">
                            <span>Route: <span className="text-foreground">{selectedTarget.pageUrl}</span></span>
                            {selectedTarget.selector && <span> · Selector: <span className="text-foreground">{selectedTarget.selector}</span></span>}
                            {selectedTarget.action && <span> · Action: <span className="text-accent">{selectedTarget.action}</span></span>}
                          </div>

                          {/* Deterministic "Why This Was Tested" Explanation List */}
                          <div className="space-y-1.5 pt-2 border-t border-white/5">
                            <span className="text-3xs uppercase tracking-widest text-muted-foreground font-bold block">
                              Why This Target Was Prioritized:
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {selectedTarget.reasons?.map((reason: string, rIdx: number) => (
                                <div key={rIdx} className="p-2 rounded bg-zinc-950/60 border border-white/5 text-3xs text-zinc-300 flex items-start gap-2">
                                  <span className="text-accent font-bold">●</span>
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Strategy Reasoning & Hypotheses */}
                      {decision.aiRecommendation && (
                        <div className="space-y-3 p-4 rounded-xl bg-zinc-900/30 border border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-3xs uppercase tracking-wider font-bold text-muted-foreground">
                              AI Strategy Reasoning & Hypotheses
                            </span>
                            <span className="text-3xs px-2 py-0.5 rounded bg-white/5 text-muted-foreground">
                              Focus: {decision.aiRecommendation.recommendedFocus}
                            </span>
                          </div>
                          <p className="text-xs text-foreground bg-zinc-950/40 p-3 rounded-lg border border-white/5">
                            {decision.aiRecommendation.strategyRationale}
                          </p>

                          {decision.aiRecommendation.investigationHypotheses?.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-3xs uppercase tracking-wider text-muted-foreground block">
                                Strategy Investigation Hypotheses:
                              </span>
                              {decision.aiRecommendation.investigationHypotheses.map((h: any, hIdx: number) => (
                                <div key={hIdx} className="p-2 rounded bg-zinc-950/40 border border-white/5 text-3xs text-zinc-300 flex items-start justify-between gap-2">
                                  <div>
                                    <span className="font-bold text-accent mr-2">[{h.confidence?.toUpperCase()}]</span>
                                    <span>{h.description}</span>
                                    {h.supportingEvidence && (
                                      <p className="text-muted-foreground text-4xs mt-0.5">Evidence: {h.supportingEvidence}</p>
                                    )}
                                  </div>
                                  <span className="text-muted-foreground text-4xs truncate max-w-xs">{h.targetUrl}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Deterministic Rankings Table */}
                      {decision.deterministicRankings && decision.deterministicRankings.length > 0 && (
                        <div>
                          <span className="text-3xs uppercase tracking-widest text-muted-foreground font-bold block mb-2">
                            Top Ranked Candidate Targets (Iteration {decision.iteration})
                          </span>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-3xs">
                              <thead>
                                <tr className="border-b border-white/10 text-muted-foreground">
                                  <th className="pb-2 font-semibold">Target ID</th>
                                  <th className="pb-2 font-semibold">Priority Score</th>
                                  <th className="pb-2 font-semibold">Primary Deterministic Reason</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {decision.deterministicRankings.slice(0, 5).map((rank: any, rkIdx: number) => (
                                  <tr key={rkIdx} className="hover:bg-white/5">
                                    <td className="py-2 text-foreground font-mono font-semibold">{rank.targetId}</td>
                                    <td className="py-2">
                                      <span className="px-2 py-0.5 rounded bg-accent/10 text-accent font-bold">
                                        {rank.score} / 100
                                      </span>
                                    </td>
                                    <td className="py-2 text-muted-foreground truncate max-w-md">
                                      {rank.reasons?.[0] || 'Standard candidate priority'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: AI QA */}
        <TabsContent value="aiqa">
          <div className="space-y-6 font-mono">
            {/* Banner */}
            <div className="border border-accent/20 bg-accent/5 rounded-2xl p-5 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${isTerminal ? 'bg-success' : 'bg-accent animate-pulse'}`} />
                  <span className="font-bold text-foreground uppercase tracking-wider text-xs">
                    Adaptive AI QA Reasoning Engine
                  </span>
                  <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent text-[10px] uppercase font-bold">
                    {aiQaResults[0]?.provider || 'mock-deterministic'}
                  </span>
                  {aiQaResults[0]?.model && (
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground text-[10px]">
                      {aiQaResults[0].model}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    isTerminal ? 'bg-success/10 text-success border border-success/20' : 'bg-accent/10 text-accent border border-accent/20'
                  }`}>
                    {testRun.status === 'running' ? 'Exploring & Testing' : isTerminal ? 'Completed' : 'Planning'}
                  </span>
                </div>
                <p className="text-muted-foreground text-3xs max-w-2xl">
                  Evidence-driven adaptive exploration loop. The AI formulates test hypotheses, analyzes step telemetry, updates its internal application state, and chooses the next best test within strict budgets.
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xs uppercase tracking-widest text-muted-foreground block">Executed Iterations</span>
                <span className="text-sm font-bold text-foreground font-mono">
                  {aiQaPlans.length} / 3 Iterations
                </span>
              </div>
            </div>

            {/* Coverage Summary Cards (if state summary is available) */}
            {aiQaStateSummary?.coverage && (
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                  Deterministic QA Coverage Metrics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Pages Visited</span>
                    <span className="text-lg font-bold text-foreground">
                      {aiQaStateSummary.coverage.pages.visited} / {aiQaStateSummary.coverage.pages.discovered}
                    </span>
                  </div>
                  <div className="bg-zinc-900/40 border border-accent/20 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-accent block">Forms Exercised</span>
                    <span className="text-lg font-bold text-accent">
                      {aiQaStateSummary.coverage.forms.exercised} / {aiQaStateSummary.coverage.forms.discovered}
                    </span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Buttons Exercised</span>
                    <span className="text-lg font-bold text-foreground">
                      {aiQaStateSummary.coverage.buttons.exercised} / {aiQaStateSummary.coverage.buttons.discovered}
                    </span>
                  </div>
                  <div className="bg-zinc-900/40 border border-white/10 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-muted-foreground block">Navigation Paths</span>
                    <span className="text-lg font-bold text-foreground">
                      {aiQaStateSummary.coverage.navigationPaths.exercised} / {aiQaStateSummary.coverage.navigationPaths.discovered}
                    </span>
                  </div>
                  <div className="bg-zinc-900/40 border border-success/20 rounded-xl p-4 text-center">
                    <span className="text-3xs uppercase tracking-wider text-success block">Hypotheses Tested</span>
                    <span className="text-lg font-bold text-success">
                      {aiQaStateSummary.coverage.hypotheses.tested} / {aiQaStateSummary.coverage.hypotheses.formulated}
                    </span>
                    <span className="text-4xs text-muted-foreground block mt-0.5">
                      {aiQaStateSummary.coverage.hypotheses.confirmed} confirmed · {aiQaStateSummary.coverage.hypotheses.disproven} disproven
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* AI QA Iterations Timeline */}
            {aiQaPlans.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-mono text-xs border border-white/5 rounded-2xl bg-zinc-950/40">
                No AI QA plans recorded for this execution run.
              </div>
            ) : (
              <div className="space-y-6">
                {aiQaPlans.map((plan: any, idx: number) => {
                  const result = aiQaResults.find((r: any) => r.iteration === plan.iteration) || aiQaResults[idx];
                  return (
                    <div
                      key={plan.planId || idx}
                      className="border border-white/10 bg-zinc-950/50 rounded-2xl p-6 space-y-5"
                    >
                      {/* Iteration Header */}
                      <div className="flex items-center justify-between border-b border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded bg-white/10 text-white font-bold text-xs">
                            Iteration {plan.iteration}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            plan.priority === 'critical' ? 'bg-danger/10 text-danger border border-danger/30' :
                            plan.priority === 'high' ? 'bg-warning/10 text-warning border border-warning/30' :
                            'bg-accent/10 text-accent border border-accent/30'
                          }`}>
                            Priority: {plan.priority}
                          </span>
                          {result?.stopReason && (
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] uppercase">
                              Stop: {result.stopReason}
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground text-3xs">
                          Plan ID: {plan.planId}
                        </span>
                      </div>

                      {/* Reasoning Summary & Strategy */}
                      <div>
                        <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-1">
                          Adaptive Next-Best-Test Strategy & Hypothesis
                        </span>
                        <p className="text-foreground text-xs leading-relaxed bg-zinc-900/60 p-3 rounded-lg border border-white/5">
                          {plan.reasoningSummary}
                        </p>
                      </div>

                      {/* Hypotheses */}
                      {plan.hypotheses && plan.hypotheses.length > 0 && (
                        <div>
                          <span className="text-3xs uppercase tracking-widest text-muted-foreground block mb-2">
                            Formulated Hypotheses ({plan.hypotheses.length})
                          </span>
                          <div className="space-y-2">
                            {plan.hypotheses.map((hyp: any, hIdx: number) => (
                              <div
                                key={hyp.id || hIdx}
                                className="flex items-start gap-2 p-2.5 rounded bg-zinc-900/40 border border-white/5 text-xs text-zinc-300"
                              >
                                <span className="text-accent font-bold">H{hIdx + 1}:</span>
                                <div className="flex-1">
                                  <p className="font-semibold text-foreground">{hyp.description}</p>
                                  <div className="flex items-center gap-3 text-3xs text-muted-foreground mt-1">
                                    <span>Target: {hyp.targetUrl}</span>
                                    {hyp.suspectedBugType && hyp.suspectedBugType !== 'NONE' && (
                                      <span className="text-warning">Suspected: {hyp.suspectedBugType}</span>
                                    )}
                                    {hyp.supportingEvidence && (
                                      <span className="text-muted-foreground">Evidence: {hyp.supportingEvidence}</span>
                                    )}
                                  </div>
                                </div>
                                <span className="text-3xs uppercase px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                                  {hyp.confidence} confidence
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Approved Actions */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-3xs uppercase tracking-widest text-success font-bold">
                              ✓ Approved Actions ({result?.approvedActions?.length || plan.actions?.length || 0})
                            </span>
                            <span className="text-4xs text-muted-foreground uppercase">Safety Validated</span>
                          </div>
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                            {(result?.approvedActions || plan.actions || []).map((act: any, aIdx: number) => (
                              <div
                                key={act.id || aIdx}
                                className="p-2 rounded bg-success/5 border border-success/20 text-3xs flex items-center justify-between gap-2"
                              >
                                <div className="truncate">
                                  <span className="font-bold text-success mr-2">[{act.type}]</span>
                                  <span className="text-foreground">{act.targetDescription}</span>
                                </div>
                                {act.selector && (
                                  <span className="text-muted-foreground text-4xs bg-zinc-900 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                                    {act.selector}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Rejected Actions */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-3xs uppercase tracking-widest text-danger font-bold">
                              ✕ Blocked / Rejected ({result?.rejectedActions?.length || 0})
                            </span>
                            <span className="text-4xs text-muted-foreground uppercase">Safety Protected</span>
                          </div>
                          {(!result?.rejectedActions || result.rejectedActions.length === 0) ? (
                            <div className="p-3 rounded bg-zinc-900/30 border border-white/5 text-3xs text-muted-foreground text-center">
                              0 actions rejected. All actions complied with safety policy.
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {result.rejectedActions.map((rej: any, rIdx: number) => (
                                <div
                                  key={rej.actionId || rIdx}
                                  className="p-2 rounded bg-danger/5 border border-danger/20 text-3xs space-y-1"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-danger">[{rej.actionType}]</span>
                                    <span className="text-4xs px-1.5 py-0.5 rounded bg-danger/10 text-danger uppercase font-bold">
                                      {rej.ruleViolated}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground text-4xs">{rej.reason}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Issues Identified */}
                      {result?.issuesIdentified && result.issuesIdentified.length > 0 && (
                        <div>
                          <span className="text-3xs uppercase tracking-widest text-warning font-bold block mb-2">
                            Issues Assessment ({result.issuesIdentified.length})
                          </span>
                          <div className="space-y-2">
                            {result.issuesIdentified.map((iss: any, iIdx: number) => (
                              <div
                                key={iIdx}
                                className="p-2.5 rounded bg-warning/5 border border-warning/20 text-xs flex items-center justify-between gap-3"
                              >
                                <div>
                                  <span className="font-bold text-warning mr-2">[{iss.confidence}]</span>
                                  <span className="text-foreground">{iss.title}</span>
                                  <p className="text-muted-foreground text-3xs mt-0.5">{iss.details}</p>
                                </div>
                                <span className="text-3xs px-2 py-0.5 rounded bg-zinc-900 text-muted-foreground uppercase font-bold">
                                  {iss.type}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab: History & Regressions */}
        <TabsContent value="history">
          <div className="mt-4 space-y-6">
            {!historicalComparison && regressionEvents.length === 0 && signals.length === 0 ? (
              <div className="bg-zinc-900/40 border border-white/10 rounded-2xl p-8 text-center space-y-3 font-mono">
                <div className="h-10 w-10 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto text-base">
                  ⚡
                </div>
                <h3 className="text-sm font-bold text-foreground">Initial Baseline Run</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  This execution is establishing the initial baseline profile for this branch, environment, and viewport.
                  Subsequent runs will automatically track score deltas, regressions, recoveries, and target stability against this baseline.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-800/60 border border-zinc-700/40 text-3xs text-muted-foreground">
                  <span>Baseline Key:</span>
                  <span className="text-foreground font-mono font-bold">
                    {testRun.projectId || 'project'}:{testRun.environment || 'staging'}:{testRun.branch || 'main'}:1280x800
                  </span>
                </div>
              </div>
            ) : (
              <>
                {/* Executive Summary Card */}
                <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-5">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-accent">Cross-Run QA Memory</span>
                        {historicalComparison?.summary && (
                          <span className={`text-4xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            historicalComparison.summary.newRegressionsCount > 0
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                          }`}>
                            {historicalComparison.summary.newRegressionsCount > 0 ? `${historicalComparison.summary.newRegressionsCount} New Regressions` : 'Regression-Free'}
                          </span>
                        )}
                        {historicalComparison?.trend && (
                          <span className={`text-4xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getTrendBadge(historicalComparison.trend).bg} ${getTrendBadge(historicalComparison.trend).border} ${getTrendBadge(historicalComparison.trend).text}`}>
                            {getTrendBadge(historicalComparison.trend).label}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-1">
                        Historical Comparison & Evolution Analysis
                      </h3>
                    </div>
                    {historicalComparison?.baselineRunId && (
                      <div className="flex items-center gap-2 text-3xs font-mono bg-zinc-950/60 border border-white/5 px-3 py-1.5 rounded-lg">
                        <span className="text-muted-foreground">Compared to Baseline:</span>
                        <Link
                          href={`/test-runs/${historicalComparison.baselineRunId}`}
                          className="text-accent hover:underline font-bold"
                        >
                          {historicalComparison.baselineRunId.slice(0, 8)}...
                        </Link>
                        {historicalComparison.baselineCreatedAt && (
                          <span className="text-muted-foreground">({new Date(historicalComparison.baselineCreatedAt).toLocaleDateString()})</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Grounded AI / Deterministic Executive Narrative */}
                  {(historicalComparison?.summary?.aiInterpretation || historicalComparison?.summary?.reason) && (
                    <div className="p-4 rounded-xl bg-zinc-950/40 border border-white/5 space-y-1.5">
                      <div className="flex items-center gap-2 text-3xs text-muted-foreground font-mono">
                        <span className="text-accent font-bold">●</span>
                        <span className="font-semibold uppercase tracking-wider">Executive Intelligence Summary</span>
                      </div>
                      <p className="text-xs text-foreground/90 font-mono leading-relaxed">
                        {historicalComparison?.summary?.aiInterpretation || historicalComparison?.summary?.reason}
                      </p>
                    </div>
                  )}

                  {/* Multi-Domain Metric Delta Scorecards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 text-center font-mono">
                      <span className="text-4xs uppercase tracking-widest text-muted-foreground block">Release Readiness</span>
                      <span className={`text-sm font-bold mt-1 block ${getScoreDeltaColor(historicalComparison?.scoreDeltas?.releaseScoreDelta)}`}>
                        {formatScoreDelta(historicalComparison?.scoreDeltas?.releaseScoreDelta)}
                      </span>
                      <span className="text-4xs text-muted-foreground">vs baseline</span>
                    </div>

                    <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 text-center font-mono">
                      <span className="text-4xs uppercase tracking-widest text-muted-foreground block">Accessibility</span>
                      <span className={`text-sm font-bold mt-1 block ${getScoreDeltaColor(historicalComparison?.scoreDeltas?.accessibilityScoreDelta)}`}>
                        {formatScoreDelta(historicalComparison?.scoreDeltas?.accessibilityScoreDelta)}
                      </span>
                      <span className="text-4xs text-muted-foreground">vs baseline</span>
                    </div>

                    <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 text-center font-mono">
                      <span className="text-4xs uppercase tracking-widest text-muted-foreground block">Performance</span>
                      <span className={`text-sm font-bold mt-1 block ${getScoreDeltaColor(historicalComparison?.scoreDeltas?.performanceScoreDelta)}`}>
                        {formatScoreDelta(historicalComparison?.scoreDeltas?.performanceScoreDelta)}
                      </span>
                      <span className="text-4xs text-muted-foreground">vs baseline</span>
                    </div>

                    <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 text-center font-mono">
                      <span className="text-4xs uppercase tracking-widest text-muted-foreground block">Security</span>
                      <span className={`text-sm font-bold mt-1 block ${getScoreDeltaColor(historicalComparison?.scoreDeltas?.securityScoreDelta)}`}>
                        {formatScoreDelta(historicalComparison?.scoreDeltas?.securityScoreDelta)}
                      </span>
                      <span className="text-4xs text-muted-foreground">vs baseline</span>
                    </div>

                    <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 text-center font-mono">
                      <span className="text-4xs uppercase tracking-widest text-muted-foreground block">New Regressions</span>
                      <span className={`text-sm font-bold mt-1 block ${
                        (historicalComparison?.summary?.newRegressionsCount || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}>
                        {historicalComparison?.summary?.newRegressionsCount ?? regressionEvents.length}
                      </span>
                      <span className="text-4xs text-muted-foreground">defects</span>
                    </div>

                    <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 text-center font-mono">
                      <span className="text-4xs uppercase tracking-widest text-muted-foreground block">Recoveries</span>
                      <span className="text-sm font-bold mt-1 block text-emerald-400">
                        {historicalComparison?.summary?.recoveredBugsCount ?? recoveryEvents.length}
                      </span>
                      <span className="text-4xs text-muted-foreground">verified fixed</span>
                    </div>
                  </div>
                </div>

                {/* New Regressions Card */}
                <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span className="text-rose-400">●</span> New Regressions Detected
                      </h4>
                      <p className="text-3xs text-muted-foreground font-mono mt-0.5">
                        Defects present in current execution that were not found in baseline run.
                      </p>
                    </div>
                    <span className={`text-3xs font-bold px-2 py-0.5 rounded font-mono ${
                      regressionEvents.length > 0 ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-zinc-800 text-muted-foreground'
                    }`}>
                      {regressionEvents.length} Regressions
                    </span>
                  </div>

                  {regressionEvents.length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-950/30 border border-white/5 text-center text-3xs font-mono text-emerald-400">
                      ✓ Zero new regressions identified. All evaluated targets matched or exceeded baseline reliability.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {regressionEvents.map((reg: any, rIdx: number) => {
                        const finding = reg.currentFinding || reg.finding || {};
                        const badge = getFindingHistoricalBadge('NEW_REGRESSION');
                        return (
                          <div
                            key={reg.id || rIdx}
                            className="p-4 rounded-xl bg-zinc-950/60 border border-rose-500/20 space-y-2 font-mono text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-4xs font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                  {badge.label}
                                </span>
                                <span className="font-bold text-foreground">
                                  {finding.title || finding.message || reg.targetIdentifier || 'Regression Defect'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {reg.businessCriticality && (
                                  <span className="text-4xs px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 uppercase font-bold">
                                    {reg.businessCriticality} Priority
                                  </span>
                                )}
                                <span className="text-4xs px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 uppercase font-bold">
                                  {finding.severity || reg.severity || 'high'}
                                </span>
                              </div>
                            </div>

                            <p className="text-3xs text-muted-foreground leading-relaxed">
                              {reg.reason || reg.rationale || finding.details || finding.message || 'Target was clean in previous run but failed in current execution.'}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-4xs text-muted-foreground pt-1 border-t border-white/5">
                              {reg.targetIdentifier && (
                                <span>Target: <span className="text-foreground">{reg.targetIdentifier}</span></span>
                              )}
                              {reg.workflowName && (
                                <span>Workflow: <span className="text-accent">{reg.workflowName}</span></span>
                              )}
                              {reg.fingerprint && (
                                <span className="text-muted-foreground/60">FP: {reg.fingerprint.slice(0, 12)}...</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Verified Recoveries Card */}
                <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <span className="text-emerald-400">●</span> Verified Defect Recoveries
                      </h4>
                      <p className="text-3xs text-muted-foreground font-mono mt-0.5">
                        Defects present in baseline that were actively retested and verified resolved in this run.
                      </p>
                    </div>
                    <span className="text-3xs font-bold px-2 py-0.5 rounded font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {recoveryEvents.length} Recovered
                    </span>
                  </div>

                  {recoveryEvents.length === 0 ? (
                    <div className="p-4 rounded-xl bg-zinc-950/30 border border-white/5 text-center text-3xs font-mono text-muted-foreground">
                      No defect recoveries verified in this test run.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recoveryEvents.map((rec: any, recIdx: number) => {
                        const badge = getFindingHistoricalBadge('RECOVERED');
                        return (
                          <div
                            key={rec.id || recIdx}
                            className="p-4 rounded-xl bg-zinc-950/60 border border-emerald-500/20 space-y-2 font-mono text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-4xs font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                  {badge.label}
                                </span>
                                <span className="font-bold text-foreground">
                                  {rec.baselineFinding?.title || rec.targetIdentifier || 'Resolved Finding'}
                                </span>
                              </div>
                              <span className="text-4xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                                Clean Retest Verified
                              </span>
                            </div>

                            <p className="text-3xs text-emerald-400/90 leading-relaxed">
                              {rec.reason || `Target "${rec.targetIdentifier}" was actively retested in this execution session and passed with zero errors.`}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-4xs text-muted-foreground pt-1 border-t border-white/5">
                              {rec.targetIdentifier && (
                                <span>Target: <span className="text-foreground">{rec.targetIdentifier}</span></span>
                              )}
                              {rec.baselineRunId && (
                                <span>Baseline Run: <span className="text-foreground">{rec.baselineRunId.slice(0, 8)}...</span></span>
                              )}
                              {rec.recoveryProof && (
                                <span className="text-teal-400">Proof: Active Journey Verification</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Recurring Defects Card */}
                {recurrenceEvents.length > 0 && (
                  <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span className="text-amber-400">●</span> Recurring Defects Watchlist
                        </h4>
                        <p className="text-3xs text-muted-foreground font-mono mt-0.5">
                          Defects persistently occurring across multiple test executions.
                        </p>
                      </div>
                      <span className="text-3xs font-bold px-2 py-0.5 rounded font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        {recurrenceEvents.length} Recurring
                      </span>
                    </div>

                    <div className="space-y-3">
                      {recurrenceEvents.map((recur: any, recIdx: number) => {
                        const badge = getFindingHistoricalBadge('RECURRING');
                        return (
                          <div
                            key={recur.id || recIdx}
                            className="p-4 rounded-xl bg-zinc-950/60 border border-amber-500/20 space-y-2 font-mono text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-4xs font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                  {badge.label}
                                </span>
                                <span className="font-bold text-foreground">
                                  {recur.finding?.title || recur.targetIdentifier || 'Persistent Defect'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-4xs px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                                  {recur.consecutiveCount || recur.consecutiveRuns || 2} Consecutive Runs
                                </span>
                                <span className="text-4xs px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold">
                                  {recur.occurrenceCount || 2}x Total
                                </span>
                              </div>
                            </div>

                            <p className="text-3xs text-muted-foreground leading-relaxed">
                              {recur.reason || `Defect has been observed in ${recur.consecutiveCount || 2} consecutive runs without resolution.`}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-4xs text-muted-foreground pt-1 border-t border-white/5">
                              {recur.targetIdentifier && (
                                <span>Target: <span className="text-foreground">{recur.targetIdentifier}</span></span>
                              )}
                              {recur.firstSeenAt && (
                                <span>First Seen: <span className="text-foreground">{new Date(recur.firstSeenAt).toLocaleDateString()}</span></span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Target Stability & Flakiness Watchlist Table */}
                {stabilitySignals.length > 0 && (
                  <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4 font-mono">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span className="text-purple-400">●</span> Target Stability & Flakiness Index
                        </h4>
                        <p className="text-3xs text-muted-foreground mt-0.5">
                          Cross-run evaluation of target flakiness, consistency, and reliability.
                        </p>
                      </div>
                      <span className="text-3xs text-muted-foreground">
                        {stabilitySignals.length} targets evaluated
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-4xs uppercase tracking-wider text-muted-foreground">
                            <th className="py-2.5 px-3">Target Identifier</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Stability Status</th>
                            <th className="py-2.5 px-3 text-center">Flake Rate</th>
                            <th className="py-2.5 px-3 text-center">Pass / Fail</th>
                            <th className="py-2.5 px-3 text-right">Consecutive</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-3xs">
                          {stabilitySignals.map((stab: any, sIdx: number) => {
                            const badge = getStabilityBadge(stab.stabilityState || stab.state);
                            return (
                              <tr key={stab.id || sIdx} className="hover:bg-zinc-950/40">
                                <td className="py-2.5 px-3 font-semibold text-foreground max-w-xs truncate">
                                  {stab.targetIdentifier || stab.target || '--'}
                                </td>
                                <td className="py-2.5 px-3 text-muted-foreground uppercase text-4xs">
                                  {stab.targetType || 'PAGE'}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-flex text-4xs font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.border} ${badge.text}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`font-bold ${
                                    (stab.flakeRate || 0) > 0.3 ? 'text-amber-400' : 'text-muted-foreground'
                                  }`}>
                                    {typeof stab.flakeRate === 'number' ? `${Math.round(stab.flakeRate * 100)}%` : '0%'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-muted-foreground">
                                  <span className="text-emerald-400 font-semibold">{stab.passCount ?? stab.passes ?? 1}P</span> / <span className="text-rose-400 font-semibold">{stab.failCount ?? stab.failures ?? 0}F</span>
                                </td>
                                <td className="py-2.5 px-3 text-right text-muted-foreground">
                                  {stab.consecutivePasses ? (
                                    <span className="text-emerald-400">+{stab.consecutivePasses} pass</span>
                                  ) : stab.consecutiveFails ? (
                                    <span className="text-rose-400">-{stab.consecutiveFails} fail</span>
                                  ) : (
                                    '--'
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Structural Coverage Trends */}
                {coverageTrends.length > 0 && (
                  <div className="bg-zinc-900/30 border border-white/10 rounded-2xl p-6 space-y-4 font-mono">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span className="text-blue-400">●</span> Structural Coverage Delta
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {coverageTrends.map((cov: any, cIdx: number) => (
                        <div key={cIdx} className="p-3.5 rounded-xl bg-zinc-950/40 border border-white/5 space-y-1">
                          <span className="text-4xs uppercase tracking-widest text-muted-foreground block">
                            {cov.dimension || 'Coverage'}
                          </span>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-foreground">
                              {cov.currentCount ?? '--'}
                            </span>
                            {typeof cov.delta === 'number' && (
                              <span className={`text-xs font-bold ${cov.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {cov.delta > 0 ? `+${cov.delta}` : cov.delta}
                              </span>
                            )}
                          </div>
                          <span className="text-4xs text-muted-foreground block">
                            Baseline: {cov.baselineCount ?? '--'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw Historical QA Memory Signals Audit Drawer */}
                {signals.length > 0 && (
                  <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 space-y-3 font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-3xs uppercase tracking-widest text-muted-foreground font-bold">
                        Historical Memory Signals Database Audit ({signals.length})
                      </span>
                      <span className="text-4xs text-muted-foreground uppercase">RLS Protected</span>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {signals.map((sig, sIdx) => (
                        <div
                          key={sig.id || sIdx}
                          className="p-2.5 rounded bg-zinc-950/50 border border-white/5 text-3xs flex items-center justify-between gap-3"
                        >
                          <div className="truncate">
                            <span className="font-bold text-accent mr-2">[{sig.signalType}]</span>
                            <span className="text-foreground">{sig.targetIdentifier}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-4xs px-1.5 py-0.5 rounded bg-zinc-900 text-muted-foreground">
                              {sig.targetType}
                            </span>
                            {sig.severity && (
                              <span className="text-4xs px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold uppercase">
                                {sig.severity}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
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
