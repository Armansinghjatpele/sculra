'use client';

import * as React from 'react';
import { Grid, Stack, Flex } from './LayoutPrimitives';
import { Input } from './Input';
import { Select } from './Select';
import { ProjectCard } from './ProjectCard';
import { EmptyState } from './EmptyState';
import { Project } from '@/lib/demoData';

export interface ProjectListProps {
  initialProjects: Project[];
  onCreateTrigger?: () => void;
}

export function ProjectList({ initialProjects, onCreateTrigger }: ProjectListProps) {
  const [projects, setProjects] = React.useState<Project[]>(initialProjects);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string>('all');

  // Sync state if initialProjects updates (e.g. from parent component inputs)
  React.useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <Stack spacing={24} className="w-full">
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
          onAction={onCreateTrigger}
        />
      )}
    </Stack>
  );
}
