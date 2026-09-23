'use client';

// ==============================================================================
// Sculra Incident Detail & Timeline Console
// (frontend/app/(authenticated)/projects/[projectId]/incidents/[incidentId]/page.tsx)
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
import { NotificationIncident, NotificationIncidentEvent } from '@/lib/demoData';
import { getProjectIncidentById, updateIncidentStatus } from '@/services/db';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  GitCommit,
  Check,
  Activity,
} from 'lucide-react';

interface IncidentDetailPageProps {
  params: Promise<{ projectId: string; incidentId: string }>;
}

export default function IncidentDetailPage({ params }: IncidentDetailPageProps) {
  const resolvedParams = use(params);
  const { projectId, incidentId } = resolvedParams;
  const { getToken, userId } = useAuth();

  const [incident, setIncident] = React.useState<NotificationIncident | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [updating, setUpdating] = React.useState(false);
  const [resolutionNotes, setResolutionNotes] = React.useState('');
  const [showResolveModal, setShowResolveModal] = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const inc = await getProjectIncidentById(token, projectId, incidentId);
        setIncident(inc);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  }, [projectId, incidentId, getToken]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcknowledge = async () => {
    setUpdating(true);
    try {
      const token = await getToken();
      if (token) {
        const updated = await updateIncidentStatus(
          token,
          incidentId,
          'ACKNOWLEDGED',
          undefined,
          userId || 'user'
        );
        if (updated) {
          setIncident((prev) => (prev ? { ...prev, ...updated } : updated));
        }
      }
    } catch {
      // Handle error
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async () => {
    setUpdating(true);
    try {
      const token = await getToken();
      if (token) {
        const updated = await updateIncidentStatus(
          token,
          incidentId,
          'RESOLVED',
          resolutionNotes || 'Resolved following manual verification.',
          userId || 'user'
        );
        if (updated) {
          setIncident((prev) => (prev ? { ...prev, ...updated } : updated));
          setShowResolveModal(false);
        }
      }
    } catch {
      // Handle error
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Stack spacing={24} className="max-w-5xl mx-auto py-8 text-center text-xs text-muted-foreground animate-pulse">
        Loading incident timeline...
      </Stack>
    );
  }

  if (!incident) {
    return (
      <Stack spacing={24} className="max-w-5xl mx-auto py-8 text-center text-xs text-muted-foreground">
        Incident not found.
        <div>
          <Link href={`/projects/${projectId}/incidents`}>
            <Button variant="outline" size="sm">Back to Incidents</Button>
          </Link>
        </div>
      </Stack>
    );
  }

  const events = incident.events || [];

  return (
    <Stack spacing={24} className="max-w-5xl mx-auto py-4">
      {/* Header */}
      <div>
        <Link
          href={`/projects/${projectId}/incidents`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Incidents
        </Link>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">{incident.title}</h1>
              <Badge
                variant={
                  incident.status === 'OPEN'
                    ? 'danger'
                    : incident.status === 'ACKNOWLEDGED'
                    ? 'warning'
                    : 'outline'
                }
                className="text-xs px-2 py-0.5"
              >
                {incident.status}
              </Badge>
              <Badge
                variant={
                  incident.severity === 'CRITICAL'
                    ? 'danger'
                    : incident.severity === 'HIGH'
                    ? 'warning'
                    : 'secondary'
                }
                className="text-xs px-2 py-0.5"
              >
                {incident.severity}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Started {new Date(incident.started_at).toLocaleString()} • Primary entity: {incident.primary_entity_type} ({incident.primary_entity_id})
            </p>
          </div>

          <div className="flex items-center gap-2">
            {incident.status === 'OPEN' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledge}
                disabled={updating}
                className="text-xs flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5" />
                Acknowledge
              </Button>
            )}
            {incident.status !== 'RESOLVED' && (
              <Button
                size="sm"
                onClick={() => setShowResolveModal(true)}
                disabled={updating}
                className="text-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Mark Resolved
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <Card className="glass-panel border-primary/30 p-4 space-y-3">
          <CardTitle className="text-sm font-bold">Resolve Incident</CardTitle>
          <p className="text-3xs text-muted-foreground">
            Provide factual resolution notes detailing verification findings or remediation applied.
          </p>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="e.g. Issue resolved after rollback verification run #42."
            className="w-full h-20 p-2.5 rounded-md bg-accent/10 border border-border/30 text-xs text-foreground resize-none focus:outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowResolveModal(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleResolve}
              disabled={updating}
              className="text-xs"
            >
              Confirm Resolution
            </Button>
          </div>
        </Card>
      )}

      {/* Incident Summary Card */}
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Incident Overview</CardTitle>
          <CardDescription className="text-3xs">
            Correlated timeline of observed events without unsupported causal claims.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-foreground leading-relaxed">{incident.summary}</p>
          {incident.resolution_notes && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="font-semibold block mb-1">Resolution Notes:</span>
              <p className="text-3xs text-emerald-300/90 leading-relaxed">{incident.resolution_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Factual Event Timeline ({events.length})
        </h2>

        {events.length > 0 ? (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border/30">
            {events.map((evt, idx) => (
              <div key={evt.id || idx} className="relative group">
                <div className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-background border-2 border-primary" />
                <div className="p-4 rounded-lg glass-panel border border-border/20 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground font-mono">
                        {evt.event_type}
                      </span>
                      <Badge variant="outline" className="text-4xs">
                        {evt.relationship}
                      </Badge>
                    </div>
                    <span className="text-3xs text-muted-foreground">
                      {new Date(evt.occurred_at).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {evt.summary}
                  </p>

                  {evt.entity_type && evt.entity_id && (
                    <div className="pt-1 text-4xs text-muted-foreground font-mono">
                      Target: {evt.entity_type} / {evt.entity_id}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="glass-panel p-8 text-center text-xs text-muted-foreground">
            No secondary timeline events attached yet. Initial trigger event is authoritative.
          </Card>
        )}
      </div>
    </Stack>
  );
}
