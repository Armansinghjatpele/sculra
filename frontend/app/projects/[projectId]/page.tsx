'use client';

import * as React from 'react';
import { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { Container, Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { TestRunTable } from '@/components/TestRunTable';
import { IssueList } from '@/components/IssueList';
import { mockProjects, mockTestRuns, mockIssues } from '@/lib/demoData';
import Link from 'next/link';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  // Resolve params promise (standard in Next.js 15/16 App Router)
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const project = mockProjects.find((p) => p.id === projectId);
  const [activeTab, setActiveTab] = React.useState('overview');

  if (!project) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <h1 className="text-lg font-bold text-foreground">Project Not Found</h1>
          <p className="text-xs text-muted-foreground mt-2">The requested project ID does not exist.</p>
          <Link href="/projects" className="mt-4 inline-block">
            <Button variant="accent" size="sm">Back to Projects</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  // Filter runs and issues related to this project
  const projectRuns = mockTestRuns.filter((r) => r.projectId === projectId);
  const projectIssues = mockIssues.filter((i) => i.projectId === projectId);

  const statusColors = {
    passed: 'success',
    running: 'accent',
    failed: 'danger',
    needs_review: 'warning',
  } as const;

  return (
    <AppShell>
      <Stack spacing={24}>
        {/* Header Title Metadata */}
        <Flex justify="between" align="center" wrap={true} className="gap-4 border-b border-border/30 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{project.name}</h1>
              <Badge variant={statusColors[project.status]} className="text-5xs uppercase tracking-wider py-0.5 px-2">
                {project.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Type: {project.type} | Target: {project.url || project.repoUrl || 'Local file archive'}
            </p>
          </div>
          <Link href="/projects">
            <Button variant="outline" size="sm">Back to Workspace</Button>
          </Link>
        </Flex>

        {/* Tab switcher using compound Tabs components */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="test-runs">Test History</TabsTrigger>
            <TabsTrigger value="issues">Issues List</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Grid cols={1} colsMd={3} gap={16} className="mt-4">
              {/* Readiness rating */}
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
                  <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Open Vulnerabilities</CardDescription>
                  <CardTitle className={`text-3xl font-extrabold mt-2 ${project.openIssuesCount > 0 ? 'text-danger' : 'text-success'}`}>
                    {project.openIssuesCount}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 mt-4 text-3xs text-muted-foreground">
                  Issues requiring review.
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

          <TabsContent value="test-runs">
            <div className="mt-4 space-y-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Automation Runs</h3>
              <TestRunTable runs={projectRuns} />
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div className="mt-4 space-y-4">
              <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Detected Exceptions</h3>
              {projectIssues.length > 0 ? (
                <IssueList issues={projectIssues} />
              ) : (
                <div className="text-xs text-muted-foreground text-center py-8">
                  No open issues identified. Excellent score stability!
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Stack>
    </AppShell>
  );
}
