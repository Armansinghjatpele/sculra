'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Container, Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ProjectCard } from '@/components/ProjectCard';
import { EmptyState } from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/Dialog';
import { URLInput } from '@/components/URLInput';
import { Select } from '@/components/Select';
import { mockProjects, Project } from '@/lib/demoData';

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[]>(mockProjects);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');
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

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <AppShell>
      <Stack spacing={24}>
        {/* Header Title Controls */}
        <Flex justify="between" align="center" wrap="wrap" className="gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Projects Workspace</h1>
            <p className="text-xs text-muted-foreground">Manage your test suites targets and configurations.</p>
          </div>
          <Button variant="accent" size="sm" onClick={() => setIsCreateOpen(true)}>
            Create Project
          </Button>
        </Flex>

        {/* Filters and Search Bar */}
        <Flex className="gap-3 w-full wrap sm:flex-nowrap">
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-9"
          />
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { label: 'All Targets', value: 'all' },
              { label: 'Websites', value: 'website' },
              { label: 'GitHub Repos', value: 'github' },
              { label: 'ZIP Bundles', value: 'zip' },
              { label: 'Desktop Apps', value: 'desktop' },
            ]}
            className="w-full sm:w-40 h-9"
          />
        </Flex>

        {/* Projects Grid List */}
        {filteredProjects.length > 0 ? (
          <Grid cols={1} colsSm={2} colsLg={3} gap={16}>
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </Grid>
        ) : (
          <EmptyState
            title="No projects found"
            description="Create your first project target to enable AI-powered testing runs."
            actionText="Create Project"
            onAction={() => setIsCreateOpen(true)}
          />
        )}
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
