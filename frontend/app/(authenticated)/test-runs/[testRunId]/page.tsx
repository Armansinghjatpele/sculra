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
  const screenshots = evidence.filter((e) => e.type === 'screenshot');
  const consoleErrors = evidence.filter((e) => e.type === 'console_error');
  const networkErrors = evidence.filter((e) => e.type === 'network_error');
  const navigationItem = evidence.find((e) => e.type === 'navigation');

  const isTerminal = testRun.status === 'passed' || testRun.status === 'failed' || testRun.status === 'cancelled';

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
              <span className="font-bold text-foreground block">Browser Execution in Progress</span>
              <p className="text-muted-foreground text-3xs mt-0.5">
                Navigating to target URL, capturing viewport traces, and logging network telemetry...
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
                Target responded successfully with HTTP 200 OK. No fatal network exceptions recorded.
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
                Exceptions were detected during execution. Inspect the evidence tabs below for details.
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
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Console Errors</CardDescription>
            <CardTitle className={`text-lg font-extrabold mt-1 font-mono ${consoleErrors.length > 0 ? 'text-danger' : 'text-success'}`}>
              {consoleErrors.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            Captured from browser
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-5">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Network Failures</CardDescription>
            <CardTitle className={`text-lg font-extrabold mt-1 font-mono ${networkErrors.length > 0 ? 'text-danger' : 'text-success'}`}>
              {networkErrors.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-3xs text-muted-foreground font-mono">
            4xx / 5xx HTTP responses
          </CardContent>
        </Card>
      </Grid>

      {/* Evidence & Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview & Navigation</TabsTrigger>
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

        {/* Tab 2: Screenshots */}
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

        {/* Tab 3: Console Logs */}
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

        {/* Tab 4: Network Requests */}
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
