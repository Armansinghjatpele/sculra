'use client';

import * as React from 'react';
import { useAuth } from '@clerk/nextjs';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { getWorkspaceActivityLog, WorkspaceActivityItem } from '@/services/db';

function formatTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export default function ActivityPage() {
  const { getToken, orgId } = useAuth();
  const [activities, setActivities] = React.useState<WorkspaceActivityItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadActivity = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await getToken();
        if (token) {
          const items = await getWorkspaceActivityLog(token, orgId);
          setActivities(items);
        } else {
          setActivities([]);
        }
      } catch (e: any) {
        console.error('[Activity Load Error]: Failed loading workspace events.', e);
        setError(e?.message || 'Failed to load workspace activity log.');
        setActivities([]);
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
      ) : error ? (
        <div className="border border-red-500/20 bg-red-950/20 rounded-xl p-8 text-center space-y-2">
          <div className="text-xs font-bold text-red-400">Failed loading workspace activity log</div>
          <p className="text-3xs text-muted-foreground font-mono">{error}</p>
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
                act.type === 'project' || act.type === 'activity'
                  ? 'bg-accent'
                  : act.status === 'passed' || act.status === 'completed'
                  ? 'bg-success'
                  : act.status === 'failed'
                  ? 'bg-danger'
                  : 'bg-zinc-600'
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
              </span>

              {/* Event card */}
              <div className="bg-zinc-900/10 border border-white/5 rounded-lg p-4 space-y-2 hover:border-white/10 transition-all">
                <Flex justify="between" align="center" className="gap-4">
                  <span className="text-xs font-bold text-foreground">{act.title}</span>
                  <span className="text-[9px] font-mono text-muted-foreground">{formatTimestamp(act.timestamp)}</span>
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
