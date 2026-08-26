import * as React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';
import { StatusBadge } from './StatusBadge';
import { Project } from '@/lib/demoData';

export function ProjectCard({ project }: { project: Project }) {
  const lastTestText = project.lastTestRun || 'No tests yet';

  return (
    <Card className="glass-panel glass-interactive flex flex-col justify-between h-full bg-zinc-950/40 border border-white/5 hover:border-white/10 transition-all rounded-xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 mb-2">
          <StatusBadge status={project.status} />
          <span className="text-[9px] text-accent uppercase tracking-widest font-bold">
            {project.type}
          </span>
        </div>
        <CardTitle className="text-sm font-semibold truncate text-foreground hover:text-accent">
          <Link href={`/projects/${project.id}`}>{project.name}</Link>
        </CardTitle>
        <CardDescription className="text-4xs text-muted-foreground mt-0.5 truncate font-mono">
          {project.url || project.repoUrl || 'Local file archive'}
        </CardDescription>
      </CardHeader>

      <CardContent className="py-2.5 space-y-2 font-mono text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Environment</span>
          <span className="font-semibold text-foreground">{project.environment || 'Staging'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Stability Score</span>
          <span className="font-semibold text-foreground">{project.releaseScore}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Open Issues</span>
          <span className={`font-semibold ${project.openIssuesCount > 0 ? 'text-danger' : 'text-success'}`}>
            {project.openIssuesCount} detected
          </span>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-white/5 text-[10px] text-muted-foreground flex justify-between items-center font-mono">
        <span>Last test: {lastTestText}</span>
        <Link href={`/projects/${project.id}`}>
          <button className="text-accent hover:underline font-semibold cursor-pointer">
            Open Project
          </button>
        </Link>
      </CardFooter>
    </Card>
  );
}
