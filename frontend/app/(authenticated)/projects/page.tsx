'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Stack } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { ProjectList } from '@/components/ProjectList';
import { getProjects } from '@/services/db';
import { Project } from '@/lib/demoData';
import Link from 'next/link';

export default function ProjectsPage() {
  const router = useRouter();
  const { getToken, orgId } = useAuth();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadProjects = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const data = await getProjects(token, orgId);
        setProjects(data);
      }
    } catch (e) {
      console.error('[Projects Load Error]: Failed loading projects target workspace.', e);
    } finally {
      setLoading(false);
    }
  }, [getToken, orgId]);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <Stack spacing={24}>
      {/* Reusable PageHeader component */}
      <PageHeader
        title="Projects Workspace"
        description="Manage your test suites targets and configurations."
        action={
          <Link href="/projects/new">
            <Button variant="accent" size="sm">
              Add Project
            </Button>
          </Link>
        }
      />

      {/* ProjectList with database projects */}
      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">Loading workspace projects...</div>
      ) : projects.length === 0 ? (
        /* Empty State */
        <div className="border border-white/5 bg-zinc-950/20 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-6 shadow-glass my-8">
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-foreground">No applications connected</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect your first application and Sculra will prepare it for automated QA.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/projects/new">
              <Button variant="accent">Connect Application</Button>
            </Link>
          </div>
        </div>
      ) : (
        <ProjectList initialProjects={projects} onCreateTrigger={() => router.push('/projects/new')} />
      )}
    </Stack>
  );
}
