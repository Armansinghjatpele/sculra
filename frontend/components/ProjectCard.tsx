import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { StatusBadge } from './StatusBadge';
import { Project } from '@/lib/demoData';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Card className="glass-panel glass-interactive flex flex-col justify-between h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 mb-2">
          <StatusBadge status={project.status} />
          <span className="text-4xs text-muted-foreground uppercase tracking-widest font-semibold">
            {project.type}
          </span>
        </div>
        <CardTitle className="text-sm font-semibold truncate hover:text-accent">
          <Link href={`/projects/${project.id}`}>{project.name}</Link>
        </CardTitle>
        <CardDescription className="text-4xs text-muted-foreground mt-0.5 truncate">
          {project.url || project.repoUrl || 'Local file archive'}
        </CardDescription>
      </CardHeader>

      <CardContent className="py-2.5 space-y-2">
        <div className="flex justify-between items-center text-4xs">
          <span className="text-muted-foreground">Release Score</span>
          <span className="font-bold text-foreground">{project.releaseScore} / 100</span>
        </div>
        <div className="flex justify-between items-center text-4xs">
          <span className="text-muted-foreground">Open Issues</span>
          <span className="font-bold text-danger">{project.openIssuesCount} detected</span>
        </div>
      </CardContent>

      <CardFooter className="pt-2 border-t border-border/20 text-4xs text-muted-foreground flex justify-between items-center">
        <span>Last run: {project.lastTestRun}</span>
        <Link href={`/projects/${project.id}`} className="text-accent hover:underline font-semibold">
          View details →
        </Link>
      </CardFooter>
    </Card>
  );
}
