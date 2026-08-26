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
  // Resolve params promise (standard in Next.js App Router)
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const { getToken, orgId } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [projectRuns, setProjectRuns] = React.useState<TestRun[]>([]);
  const [projectIssues, setProjectIssues] = React.useState<Issue[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');

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

  const testReadiness = project.type === 'website' ? 'Ready to test' : 'Connection pending';

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
                  {project.releaseScore}%
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-4 text-3xs text-muted-foreground">
                Calculated from last {projectRuns.length} automation runs.
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
                Issues requiring immediate code validation.
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
        </TabsContent>

        <TabsContent value="connection">
          <div className="mt-4">
            <Card className="glass-panel p-6">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest mb-4">Target Integration Scoping</h3>
              <div className="space-y-4 font-mono text-xs">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span className="text-muted-foreground">Source Type</span>
                  <span className="text-foreground uppercase">{project.type}</span>
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
                  <span className="text-muted-foreground">Target Environment</span>
                  <span className="text-foreground">{project.environment || 'Staging'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-success font-bold uppercase tracking-wider">Connected</span>
                </div>
              </div>
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
              <div className="text-xs text-muted-foreground text-center py-8">
                No open issues identified. Excellent score stability!
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
              <div className="text-xs text-muted-foreground text-center py-8">No reports compiled yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
