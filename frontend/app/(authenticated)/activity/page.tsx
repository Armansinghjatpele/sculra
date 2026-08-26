'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { getProjects, getTestRuns } from '@/services/db';
import { Project, TestRun } from '@/lib/demoData';

interface ActivityLogItem {
  id: string;
  type: 'project' | 'run';
  title: string;
  description: string;
  timestamp: string;
  status: string;
}

export default function ActivityPage() {
  const { getToken, orgId } = useAuth();
  const [activities, setActivities] = React.useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadActivity = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        if (token) {
          const [projs, runs] = await Promise.all([
            getProjects(token, orgId),
            getTestRuns(token, orgId),
          ]);

          const list: ActivityLogItem[] = [];

          // Add project configuration events
          projs.forEach((p: Project) => {
            list.push({
              id: `proj-${p.id}`,
              type: 'project',
              title: 'Project Configured',
              description: `Target project "${p.name}" (${p.type}) registered at target ${p.url || p.repoUrl || 'Local'}`,
              timestamp: 'Recently',
              status: p.status,
            });
          });

          // Add run events
          runs.forEach((r: TestRun) => {
            list.push({
              id: `run-${r.id}`,
              type: 'run',
              title: 'Test Sweep Triggered',
              description: `AI sweep #${r.id} for "${r.projectName || 'Synced Project'}" completed with score ${r.releaseScore}%`,
              timestamp: r.createdAt || 'Recently',
              status: r.status,
            });
          });

          setActivities(list);
        }
      } catch (e) {
        console.error('[Activity Load Error]: Failed loading workspace events.', e);
      } finally {
        setLoading(false);
      }
    };
    loadActivity();
  }, [getToken, orgId]);

  return (
    <Stack spacing={24}>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Workspace Activity Log</h1>
        <p className="text-xs text-muted-foreground">Historical timeline of deployments, configuration changes, and automation sweeps.</p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-muted-foreground font-mono">
          Loading workspace activity log...
        </div>
      ) : activities.length === 0 ? (
        <div className="border border-white/5 bg-zinc-950/20 rounded-xl p-12 text-center space-y-3">
          <div className="text-xs font-bold text-foreground">No activity log found</div>
          <p className="text-3xs text-muted-foreground">Activities will log automatically when project sweeps run.</p>
        </div>
      ) : (
        <div className="relative border-l border-white/5 pl-6 ml-2 space-y-6">
          {activities.map((act) => (
            <div key={act.id} className="relative group">
              {/* Timeline bubble/node */}
              <span className={`absolute -left-[30px] top-1 h-3.5 w-3.5 rounded-full border border-zinc-950 flex items-center justify-center ${
                act.type === 'project' ? 'bg-accent' : act.status === 'passed' ? 'bg-success' : 'bg-danger'
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
              </span>

              {/* Event card */}
              <div className="bg-zinc-900/10 border border-white/5 rounded-lg p-4 space-y-2 hover:border-white/10 transition-all">
                <Flex justify="between" align="center" className="gap-4">
                  <span className="text-xs font-bold text-foreground">{act.title}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{act.timestamp}</span>
                </Flex>
                <p className="text-3xs text-muted-foreground font-mono leading-relaxed">{act.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Stack>
  );
}
