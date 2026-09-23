'use client';

// ==============================================================================
// Sculra Project Incidents Dashboard
// (frontend/app/(authenticated)/projects/[projectId]/incidents/page.tsx)
// ==============================================================================

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { NotificationIncident, Project } from '@/lib/demoData';
import { getProject, getProjectIncidents } from '@/services/db';
import { AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

interface IncidentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default function IncidentsPage({ params }: IncidentsPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { getToken } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [incidents, setIncidents] = React.useState<NotificationIncident[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const [proj, incs] = await Promise.all([
          getProject(token, projectId),
          getProjectIncidents(token, projectId),
        ]);
        setProject(proj);
        setIncidents(incs);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [projectId, getToken]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = incidents.filter((i) => {
    if (statusFilter === 'ALL') return true;
    return i.status === statusFilter;
  });

  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const acknowledgedCount = incidents.filter((i) => i.status === 'ACKNOWLEDGED').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  return (
    <Stack spacing={24} className="max-w-6xl mx-auto py-4">
      <PageHeader
        title={`Incidents — ${project?.name || 'Project'}`}
        description="Factual correlation of regression events, release blocks, and system health degradation."
      />

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-panel">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-3xs font-semibold text-muted-foreground uppercase">Open Incidents</p>
              <h2 className="text-2xl font-bold text-destructive mt-0.5">{openCount}</h2>
            </div>
            <AlertTriangle className="w-6 h-6 text-destructive/50" />
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-3xs font-semibold text-muted-foreground uppercase">Acknowledged</p>
              <h2 className="text-2xl font-bold text-warning mt-0.5">{acknowledgedCount}</h2>
            </div>
            <Clock className="w-6 h-6 text-warning/50" />
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-3xs font-semibold text-muted-foreground uppercase">Resolved</p>
              <h2 className="text-2xl font-bold text-emerald-400 mt-0.5">{resolvedCount}</h2>
            </div>
            <CheckCircle2 className="w-6 h-6 text-emerald-400/50" />
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 pb-1 border-b border-border/20">
        {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
              statusFilter === s
                ? 'bg-primary/20 text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s} ({s === 'ALL' ? incidents.length : incidents.filter((i) => i.status === s).length})
          </button>
        ))}
      </div>

      {/* Incident List */}
      <Card className="glass-panel w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            {filtered.length} Incident{filtered.length === 1 ? '' : 's'} Tracked
          </CardTitle>
          <CardDescription className="text-3xs">
            Incidents correlate observed facts across deployments, test runs, and environments without unsupported causality assertions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">
              Loading incidents...
            </div>
          ) : filtered.length > 0 ? (
            <div className="divide-y divide-border/20">
              {filtered.map((inc) => (
                <Link
                  key={inc.id}
                  href={`/projects/${projectId}/incidents/${inc.id}`}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-accent/5 transition-colors gap-3 block"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">
                        {inc.title}
                      </span>
                      <Badge
                        variant={
                          inc.status === 'OPEN'
                            ? 'danger'
                            : inc.status === 'ACKNOWLEDGED'
                            ? 'warning'
                            : 'outline'
                        }
                        className="text-4xs px-1.5 py-0"
                      >
                        {inc.status}
                      </Badge>
                      <Badge
                        variant={
                          inc.severity === 'CRITICAL'
                            ? 'danger'
                            : inc.severity === 'HIGH'
                            ? 'warning'
                            : 'secondary'
                        }
                        className="text-4xs px-1.5 py-0"
                      >
                        {inc.severity}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {inc.summary}
                    </p>

                    <div className="pt-1 flex items-center gap-3 text-3xs text-muted-foreground">
                      <span>Primary: {inc.primary_entity_type} ({inc.primary_entity_id})</span>
                      <span>•</span>
                      <span>Started: {new Date(inc.started_at).toLocaleString()}</span>
                      <span>•</span>
                      <span>Updated: {new Date(inc.last_updated_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 text-muted-foreground">
                    <span className="text-3xs hidden sm:inline">View Timeline</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-muted-foreground">
              No active incidents detected for this project.
            </div>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}
