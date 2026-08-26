'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { PageHeader } from '@/components/PageHeader';
import { ProjectList } from '@/components/ProjectList';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/Dialog';
import { URLInput } from '@/components/URLInput';
import { Select } from '@/components/Select';
import { mockProjects, Project } from '@/lib/demoData';

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>(mockProjects);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  // New project input form states
  const [newProjectName, setNewProjectName] = React.useState('');
  const [newProjectType, setNewProjectType] = React.useState<'website' | 'github' | 'zip' | 'desktop'>('website');
  const [newProjectUrl, setNewProjectUrl] = React.useState('');

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: newProjectName,
      type: newProjectType,
      status: 'running',
      lastTestRun: 'Just now',
      releaseScore: 100,
      openIssuesCount: 0,
      url: newProjectType === 'website' ? newProjectUrl : undefined,
      repoUrl: newProjectType === 'github' ? newProjectUrl : undefined,
    };
    setProjects([newProj, ...projects]);
    setIsCreateOpen(false);
    // Reset states
    setNewProjectName('');
    setNewProjectUrl('');
  };

  return (
    <AppShell>
      <Stack spacing={24}>
        {/* Reusable PageHeader component */}
        <PageHeader
          title="Projects Workspace"
          description="Manage your test suites targets and configurations."
          action={
            <Button variant="accent" size="sm" onClick={() => setIsCreateOpen(true)}>
              Create Project
            </Button>
          }
        />

        {/* Reusable ProjectList component */}
        <ProjectList initialProjects={projects} onCreateTrigger={() => setIsCreateOpen(true)} />
      </Stack>

      {/* 2. Create Project Modal Dialog */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Project Target</DialogTitle>
            <DialogDescription>
              Configure the application bundle or URL Sculra QA agents will inspect.
            </DialogDescription>
          </DialogHeader>

          <Stack spacing={16} className="py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Project Name</label>
              <Input
                placeholder="e.g. My SaaS Dashboard"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Target Type</label>
              <Select
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value as any)}
                options={[
                  { label: 'Website URL', value: 'website' },
                  { label: 'GitHub Repository', value: 'github' },
                  { label: 'ZIP Bundle Upload', value: 'zip' },
                  { label: 'Desktop Executable (EXE)', value: 'desktop' },
                ]}
              />
            </div>

            {(newProjectType === 'website' || newProjectType === 'github') && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Target URL</label>
                <URLInput
                  value={newProjectUrl}
                  onChange={(val) => setNewProjectUrl(val)}
                  isGitHubUrl={newProjectType === 'github'}
                />
              </div>
            )}

            {newProjectType === 'zip' && (
              <div className="p-6 border border-dashed border-border rounded-lg text-center bg-muted/10">
                <p className="text-xs text-muted-foreground">ZIP file drag-and-drop placeholder (UI only)</p>
              </div>
            )}

            {newProjectType === 'desktop' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Executable Command / Path</label>
                <Input placeholder="e.g. ./dist/app.exe" disabled />
              </div>
            )}
          </Stack>

          <DialogFooter className="border-t border-border/20 pt-4">
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" size="sm" onClick={handleCreateProject}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
