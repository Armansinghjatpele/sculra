'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { PageHeader } from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { TestRunTable } from '@/components/TestRunTable';
import { IssueList } from '@/components/IssueList';
import { getProject, getTestRuns, getIssues } from '@/services/db';
import { Project, TestRun, Issue } from '@/lib/demoData';
import Link from 'next/link';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const { getToken, orgId } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [projectRuns, setProjectRuns] = React.useState<TestRun[]>([]);
  const [projectIssues, setProjectIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');

  // Connection check states
  const [checking, setChecking] = React.useState(false);
  const [healthStatus, setHealthStatus] = React.useState<string | null>(null);
  const [statusCode, setStatusCode] = React.useState<number | null>(null);
  const [responseTime, setResponseTime] = React.useState<number | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lastChecked, setLastChecked] = React.useState<string | null>(null);

  // Trigger feedback state for "Run Test" action
  const [testEngineAlert, setTestEngineAlert] = React.useState(false);

  React.useEffect(() => {
    const loadProjectData = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const [proj, runs, iss] = await Promise.all([
            getProject(token, projectId),
            getTestRuns(token, orgId),
            getIssues(token, orgId),
          ]);
          setProject(proj);
          setProjectRuns(runs.filter((r) => r.projectId === projectId));
          setProjectIssues(iss.filter((i) => i.projectId === projectId));
        }
      } catch (e) {
        console.error('[ProjectDetail Load Error]: Failed loading project data.', e);
      } finally {
        setLoading(false);
      }
    };
    loadProjectData();
  }, [getToken, orgId, projectId]);

  const handleCheckConnection = async () => {
    setChecking(true);
    setHealthStatus('checking');
    setErrorMessage(null);
    try {
      const res = await fetch('/api/projects/check-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (res.ok) {
        setHealthStatus(data.status);
        setStatusCode(data.statusCode);
        setResponseTime(data.responseTime);
        setErrorMessage(data.error);
        setLastChecked(new Date().toLocaleTimeString());
      } else {
        setHealthStatus('connection_failed');
        setErrorMessage(data.error || 'Server connection check failure');
      }
    } catch (e: any) {
      setHealthStatus('connection_failed');
      setErrorMessage(e.message || 'DNS connection check failure');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground font-mono">
        Loading project workspace details...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12 text-center max-w-sm mx-auto space-y-4">
        <h1 className="text-lg font-bold text-foreground">Project Not Found</h1>
        <p className="text-xs text-muted-foreground">The requested project ID does not exist in this workspace scope.</p>
        <Link href="/projects" className="mt-4 inline-block">
          <Button variant="accent" size="sm">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  // Get most recent test run sorted descending by creation time
  const sortedRuns = [...projectRuns].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latestRun = sortedRuns[0] || null;

  const testReadiness = project.type === 'website' ? 'Ready to test' : 'Connection pending';
  const displayScore = project.releaseScore !== null ? `${project.releaseScore}%` : 'No release score yet';

  return (
    <Stack spacing={24}>
      {/* Page header with Run Test trigger */}
      <PageHeader
        title={project.name}
        description={`Environment: ${project.environment || 'Staging'} | Status: ${testReadiness}`}
        action={
          <div className="flex items-center gap-3">
            <StatusBadge status={project.status} />
            <Button variant="accent" size="sm" onClick={() => setTestEngineAlert(true)}>
              Run Test
            </Button>
            <Link href="/projects">
              <Button variant="outline" size="sm">Back</Button>
            </Link>
          </div>
        }
      />

      {testEngineAlert && (
        <div className="p-4 border border-accent/25 bg-accent/5 rounded-xl flex items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1">
            <span className="text-accent font-bold uppercase tracking-wider block">🚀 On-Demand Testing</span>
            <p className="text-muted-foreground">Testing engine coming next. We are working on custom Playwright crawling executors.</p>
          </div>
          <button 
            onClick={() => setTestEngineAlert(false)} 
            className="text-muted-foreground hover:text-foreground font-bold text-sm cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
          <TabsTrigger value="test-runs">Test Runs</TabsTrigger>
          <TabsTrigger value="issues">Issues</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Grid cols={1} colsMd={3} gap={16} className="mt-4">
            {/* Stability rating */}
            <Card className="glass-panel col-span-1 text-center py-6">
              <CardHeader className="p-0">
                <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Stability Score</CardDescription>
                <CardTitle className="text-3xl font-extrabold text-foreground mt-2">
                  {displayScore}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4 text-3xs text-muted-foreground">
                {project.releaseScore !== null 
                  ? `Calculated from last ${projectRuns.length} automation runs.` 
                  : 'Run checks to initialize release scoring index.'}
              </CardContent>
            </Card>

            {/* Open Issues Count */}
            <Card className="glass-panel col-span-1 text-center py-6">
              <CardHeader className="p-0">
                <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Open Issues</CardDescription>
                <CardTitle className={`text-3xl font-extrabold mt-2 ${projectIssues.length > 0 ? 'text-danger' : 'text-success'}`}>
                  {projectIssues.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4 text-3xs text-muted-foreground">
                {projectIssues.length > 0 
                  ? `${projectIssues.length} issues require code validation.` 
                  : 'No open issues detected.'}
              </CardContent>
            </Card>

            {/* Target configuration summary */}
            <Card className="glass-panel col-span-1 text-center py-6">
              <CardHeader className="p-0">
                <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Configured Target</CardDescription>
                <CardTitle className="text-xs font-bold text-foreground mt-4 truncate px-4">
                  {project.url || project.repoUrl || 'Local file archive'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4 text-3xs text-muted-foreground">
                Target type: {project.type}
              </CardContent>
            </Card>
          </Grid>

          {/* Detailed Overview list details */}
          <div className="mt-6 bg-zinc-900/20 border border-white/5 p-6 rounded-xl space-y-4 font-mono text-xs">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">Project Specification Details</h3>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Project Name</span>
              <span className="text-foreground font-semibold">{project.name}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Source Type</span>
              <span className="text-accent uppercase font-bold">{project.type}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Target Environment</span>
              <span className="text-foreground">{project.environment || 'Staging'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Endpoint / Repository</span>
              <span className="text-foreground">{project.url || project.repoUrl || 'Local'}</span>
            </div>
            {project.type === 'github' && (
              <div className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-muted-foreground">Branch</span>
                <span className="text-foreground font-semibold">{project.branch || 'main'}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-muted-foreground">Connection Status</span>
              <span className="text-success font-bold uppercase tracking-wider">● Connected</span>
            </div>
            {project.createdAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created Date</span>
                <span className="text-foreground">{project.createdAt}</span>
              </div>
            )}
          </div>

          {/* Latest Run telemetry summary */}
          <div className="mt-6 bg-zinc-900/20 border border-white/5 p-6 rounded-xl space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">Latest Run Summary</h3>
            {latestRun ? (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 font-mono text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[10px] uppercase">Status</span>
                  <StatusBadge status={latestRun.status} />
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[10px] uppercase">Created</span>
                  <span className="text-foreground font-semibold block">{new Date(latestRun.createdAt).toLocaleString()}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[10px] uppercase">Duration</span>
                  <span className="text-foreground font-semibold block">{latestRun.durationMs ? `${(latestRun.durationMs / 1000).toFixed(2)}s` : '--'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[10px] uppercase">Issues</span>
                  <span className="text-danger font-semibold block">{latestRun.issuesCount} detected</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[10px] uppercase">Overall Score</span>
                  <span className="text-accent font-semibold block">{latestRun.releaseScore}%</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4 font-mono">
                No tests yet
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="connection">
          <div className="mt-4">
            <Card className="glass-panel p-6">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest mb-4 font-mono">Connection Settings</h3>

              {project.type === 'website' && (
                <div className="space-y-4">
                  <div className="space-y-1 font-mono text-xs">
                    <span className="text-muted-foreground block">Website URL</span>
                    <span className="text-foreground block break-all font-semibold">{project.url}</span>
                  </div>

                  <div className="p-4 border border-white/5 bg-zinc-950/40 rounded-xl flex items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1.5">
                      <span className="text-muted-foreground block text-[10px] uppercase">STATUS</span>
                      <div className="flex items-center gap-2">
                        {checking ? (
                          <>
                            <span className="animate-pulse text-zinc-400">Checking...</span>
                          </>
                        ) : healthStatus === 'connected' ? (
                          <>
                            <span className="text-success font-bold">● Connected</span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-foreground">HTTP {statusCode}</span>
                            {responseTime !== null && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span className="text-foreground">{responseTime} ms</span>
                              </>
                            )}
                          </>
                        ) : healthStatus === 'connection_failed' ? (
                          <>
                            <span className="text-danger font-bold">● Connection failed</span>
                            {statusCode !== null && (
                              <>
                                <span className="text-muted-foreground">|</span>
                                <span className="text-foreground">HTTP {statusCode}</span>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="text-zinc-400">Not verified yet</span>
                        )}
                      </div>
                      {lastChecked && (
                        <span className="text-[10px] text-muted-foreground block mt-1">Last checked: {lastChecked}</span>
                      )}
                      {errorMessage && (
                        <span className="text-danger text-[10px] block mt-1">Error: {errorMessage}</span>
                      )}
                    </div>

                    <Button variant="outline" size="sm" onClick={handleCheckConnection} disabled={checking}>
                      {checking ? 'Checking...' : 'Check Connection'}
                    </Button>
                  </div>
                </div>
              )}

              {project.type === 'github' && (
                <div className="space-y-4">
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground">GitHub Repository</span>
                      <span className="text-foreground font-semibold">{project.repoUrl}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground">Target Branch</span>
                      <span className="text-foreground font-semibold">{project.branch || 'main'}</span>
                    </div>
                  </div>

                  <div className="p-4 border border-white/5 bg-zinc-950/40 rounded-xl flex items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-[10px] uppercase">STATUS</span>
                      {checking ? (
                        <span className="animate-pulse text-zinc-400">Checking...</span>
                      ) : healthStatus === 'connection_pending' ? (
                        <span className="text-warning font-bold">● Connection pending</span>
                      ) : (
                        <span className="text-zinc-400">Not verified yet</span>
                      )}
                      {errorMessage && (
                        <p className="text-warning text-[10px] mt-1">{errorMessage}</p>
                      )}
                    </div>

                    <Button variant="outline" size="sm" onClick={handleCheckConnection} disabled={checking}>
                      {checking ? 'Checking...' : 'Check Connection'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="test-runs">
          <div className="mt-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Automation Runs</h3>
            {projectRuns.length > 0 ? (
              <TestRunTable runs={projectRuns} />
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8">
                No tests yet. Run your first sweep using the CTA trigger.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="issues">
          <div className="mt-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Open Exceptions</h3>
            {projectIssues.length > 0 ? (
              <IssueList issues={projectIssues} />
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8 font-mono">
                No open issues
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <div className="mt-4 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Reports Compiled</h3>
            {projectRuns.length > 0 ? (
              <div className="overflow-x-auto border border-white/5 rounded-xl bg-zinc-950/40">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase text-muted-foreground">
                      <th className="p-4">Report ID</th>
                      <th className="p-4">Stability Score</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[11px]">
                    {projectRuns.map((r) => (
                      <tr key={r.id} className="hover:bg-white/5">
                        <td className="p-4 text-muted-foreground">{r.id}</td>
                        <td className="p-4 text-accent font-bold">{r.releaseScore}%</td>
                        <td className="p-4 text-foreground uppercase">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-8 font-mono">No reports compiled yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
