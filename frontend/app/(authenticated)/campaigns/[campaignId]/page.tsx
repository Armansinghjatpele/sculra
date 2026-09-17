'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Stack, Flex, Grid } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import {
  Campaign,
  CampaignTask,
  TestEvidence,
  CampaignStage,
  CampaignDomain,
} from '@/lib/demoData';
import {
  getObjectiveLabel,
  getStageLabel,
  getDomainLabel,
  getCampaignStatusBadgeClass,
  getTaskStatusBadgeClass,
  getVerdictBadgeClass,
  formatDuration,
  formatScore,
} from '@/lib/campaignUtils';

interface CampaignDetailPageProps {
  params: Promise<{ campaignId: string }>;
}

const STAGES_ORDER: CampaignStage[] = [
  'DISCOVERY_MAPPING',
  'SURFACE_VERIFICATION',
  'DEEP_ENGINE_AUDITS',
  'HISTORICAL_CORRELATION',
  'RELEASE_EVALUATION',
];

export default function CampaignControlPlanePage({ params }: CampaignDetailPageProps) {
  const resolvedParams = use(params);
  const campaignId = resolvedParams.campaignId;

  const { getToken } = useAuth();
  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [tasks, setTasks] = React.useState<CampaignTask[]>([]);
  const [evidence, setEvidence] = React.useState<TestEvidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState('tasks');

  // Polling data
  const loadCampaignData = React.useCallback(async () => {
    try {
      const [campRes, tasksRes, evRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/tasks`),
        fetch(`/api/campaigns/${campaignId}/evidence`),
      ]);

      if (campRes.ok) {
        const campData = await campRes.json();
        if (campData.success && campData.campaign) {
          setCampaign(campData.campaign);
        }
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        if (tasksData.success && tasksData.tasks) {
          setTasks(tasksData.tasks);
        }
      }

      if (evRes.ok) {
        const evData = await evRes.json();
        if (evData.success && evData.evidence) {
          setEvidence(evData.evidence);
        }
      }
    } catch (e) {
      console.error('[Campaign Load Error]:', e);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  React.useEffect(() => {
    loadCampaignData();
    // Poll every 3 seconds if RUNNING or PENDING
    const interval = setInterval(() => {
      if (campaign?.status === 'RUNNING' || campaign?.status === 'PENDING') {
        loadCampaignData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, loadCampaignData]);

  const handleStartCampaign = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start campaign execution');
      }
      setActionMessage('Campaign queued for autonomous execution.');
      await loadCampaignData();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCampaign = async () => {
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/cancel`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel campaign');
      }
      setActionMessage('Campaign cancellation requested.');
      await loadCampaignData();
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="py-24 text-center font-mono text-xs text-muted-foreground">
        Loading Autonomous QA Control Plane...
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-16 text-center max-w-sm mx-auto space-y-4 font-mono">
        <h2 className="text-base font-bold text-foreground">Campaign Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested campaign does not exist or has been removed.
        </p>
        <Link href="/projects">
          <Button variant="accent" size="sm">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const progress = campaign.progressSnapshot;
  const summary = campaign.summary;
  const isRunning = campaign.status === 'RUNNING' || campaign.status === 'PENDING';

  return (
    <Stack spacing={24}>
      {/* Top Header */}
      <PageHeader
        title={campaign.name}
        description={`Objective: ${getObjectiveLabel(campaign.objective)} | Target: ${campaign.config?.targetUrl || '--'} | Environment: ${campaign.config?.environment || 'Staging'}`}
        action={
          <Flex align="center" className="gap-3">
            <span
              className={`inline-flex px-2.5 py-1 rounded-md text-3xs font-bold uppercase border ${getCampaignStatusBadgeClass(
                campaign.status
              )}`}
            >
              {campaign.status}
            </span>

            {isRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelCampaign}
                disabled={actionLoading}
                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              >
                Cancel Campaign
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                onClick={handleStartCampaign}
                disabled={actionLoading}
              >
                Rerun Campaign
              </Button>
            )}

            <Link href={`/projects/${campaign.projectId}/campaigns`}>
              <Button variant="outline" size="sm">All Campaigns</Button>
            </Link>
          </Flex>
        }
      />

      {actionMessage && (
        <div className="p-3 bg-surface-light border border-border rounded-xl text-xs font-mono text-muted-foreground flex justify-between items-center">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-foreground hover:text-accent font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 5-Stage Directed Acyclic Graph (DAG) Pipeline Indicator */}
      <Card className="glass-panel p-6 space-y-4">
        <Flex justify="between" align="center">
          <div className="space-y-0.5">
            <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground">
              Autonomous Campaign Pipeline DAG
            </span>
            <h3 className="text-sm font-bold text-foreground">
              Current Stage: {getStageLabel(campaign.currentStage)}
            </h3>
          </div>
          <div className="text-right font-mono text-3xs text-muted-foreground">
            {progress?.percentComplete !== undefined ? `${progress.percentComplete}% Complete` : '--'}
          </div>
        </Flex>

        {/* Stages Timeline */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
          {STAGES_ORDER.map((stage, idx) => {
            const currentIdx = STAGES_ORDER.indexOf(campaign.currentStage);
            let stageState: 'completed' | 'active' | 'pending' = 'pending';

            if (campaign.status === 'COMPLETED') {
              stageState = 'completed';
            } else if (idx < currentIdx) {
              stageState = 'completed';
            } else if (idx === currentIdx) {
              stageState = isRunning ? 'active' : 'completed';
            }

            return (
              <div
                key={stage}
                className={`p-3 rounded-xl border transition-all ${
                  stageState === 'active'
                    ? 'bg-sky-500/10 border-sky-500/40 shadow-sm shadow-sky-500/10'
                    : stageState === 'completed'
                    ? 'bg-emerald-500/5 border-emerald-500/30'
                    : 'bg-surface-light/30 border-border/40 opacity-60'
                }`}
              >
                <Flex justify="between" align="center" className="mb-1">
                  <span className="text-4xs font-mono text-muted-foreground font-semibold">
                    0{idx + 1}
                  </span>
                  {stageState === 'completed' && (
                    <span className="text-emerald-400 text-3xs font-bold font-mono">DONE</span>
                  )}
                  {stageState === 'active' && (
                    <span className="text-sky-400 text-3xs font-bold font-mono animate-pulse">RUNNING</span>
                  )}
                  {stageState === 'pending' && (
                    <span className="text-muted-foreground text-3xs font-mono">QUEUED</span>
                  )}
                </Flex>
                <div className="text-xs font-bold text-foreground truncate">
                  {stage.replace(/_/g, ' ')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-light rounded-full h-2 overflow-hidden border border-border/40 mt-2">
          <div
            className={`h-full transition-all duration-500 ${
              campaign.status === 'FAILED'
                ? 'bg-rose-500'
                : campaign.status === 'COMPLETED'
                ? 'bg-emerald-500'
                : 'bg-accent animate-pulse'
            }`}
            style={{ width: `${progress?.percentComplete || (campaign.status === 'COMPLETED' ? 100 : 0)}%` }}
          />
        </div>
      </Card>

      {/* KPI Highlights Grid */}
      <Grid cols={1} colsMd={4} gap={16}>
        {/* Release Verdict Card */}
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Authoritative Release Verdict
          </span>
          <div className="mt-2">
            {campaign.releaseVerdict ? (
              <span
                className={`inline-flex px-3 py-1 rounded text-xs font-bold uppercase border ${getVerdictBadgeClass(
                  campaign.releaseVerdict
                )}`}
              >
                {campaign.releaseVerdict.replace(/_/g, ' ')}
              </span>
            ) : (
              <span className="text-lg font-bold text-muted-foreground font-mono">
                {isRunning ? 'EVALUATING...' : '--'}
              </span>
            )}
          </div>
        </Card>

        {/* Release Score Card (Zero Metric Fabrication) */}
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Overall Release Score
          </span>
          <span className="text-2xl font-black font-mono mt-2 block text-foreground">
            {formatScore(campaign.overallScore ?? summary?.releaseReadiness?.overallScore)}
          </span>
        </Card>

        {/* Tasks Progress Card */}
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Tasks Completed / Total
          </span>
          <span className="text-2xl font-black font-mono mt-2 block text-foreground">
            {tasks.filter((t) => t.status === 'COMPLETED').length} / {tasks.length || campaign.config?.budget?.maxTasks || 25}
          </span>
        </Card>

        {/* Duration & Budget Card */}
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Elapsed Duration
          </span>
          <span className="text-2xl font-black font-mono mt-2 block text-foreground">
            {formatDuration(progress?.elapsedDurationMs ?? summary?.durationMs)}
          </span>
        </Card>
      </Grid>

      {/* Multi-Domain Coverage Breakdown */}
      {progress?.coverage?.domainCoveragePercentage && (
        <Card className="glass-panel p-5 space-y-3">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block">
            Domain Coverage Matrix (12 Autonomous Engines)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
            {Object.entries(progress.coverage.domainCoveragePercentage).map(([domain, pct]) => (
              <div key={domain} className="p-2.5 rounded-lg bg-surface-light/40 border border-border/40 space-y-1">
                <span className="text-4xs font-mono text-muted-foreground truncate block capitalize">
                  {getDomainLabel(domain as CampaignDomain)}
                </span>
                <Flex justify="between" align="baseline">
                  <span className="text-xs font-bold font-mono text-foreground">{pct}%</span>
                  <div className="w-12 bg-surface rounded-full h-1.5 overflow-hidden border border-border/30">
                    <div
                      className="bg-accent h-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Flex>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabbed Control Plane Details */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tasks">
            Task Queue ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="correlations">
            Correlations ({summary?.crossDomainCorrelations?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="release">
            Release Scorecard
          </TabsTrigger>
          <TabsTrigger value="evidence">
            Evidence Feed ({evidence.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Tasks Queue */}
        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <Card className="glass-panel p-8 text-center text-xs font-mono text-muted-foreground">
              No tasks scheduled yet. Campaign planner initializes tasks upon launch.
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50 bg-surface/50">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-surface-light/40 border-b border-border/50 text-muted-foreground">
                  <tr>
                    <th className="p-3 pl-4">Task Key</th>
                    <th className="p-3">Stage</th>
                    <th className="p-3">Domain</th>
                    <th className="p-3">Target Identifier</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Observations</th>
                    <th className="p-3">Issues</th>
                    <th className="p-3 pr-4">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-foreground">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-surface-light/30 transition-colors">
                      <td className="p-3 pl-4 font-semibold text-foreground">{task.taskKey}</td>
                      <td className="p-3 text-muted-foreground text-3xs">{task.stage}</td>
                      <td className="p-3">
                        <span className="capitalize text-accent font-medium">
                          {getDomainLabel(task.domain)}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-xs">
                        {task.target?.identifier || '--'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-4xs font-bold uppercase border ${getTaskStatusBadgeClass(
                            task.status
                          )}`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{task.observationsCount}</td>
                      <td className="p-3">
                        {task.issuesDetected > 0 ? (
                          <span className="text-rose-400 font-bold">{task.issuesDetected}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="p-3 pr-4 text-muted-foreground">{formatDuration(task.durationMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab: Cross-Domain Correlations */}
        <TabsContent value="correlations">
          {!summary?.crossDomainCorrelations || summary.crossDomainCorrelations.length === 0 ? (
            <Card className="glass-panel p-8 text-center text-xs font-mono text-muted-foreground">
              No cross-domain anomalies detected. Engines verified isolated behaviors.
            </Card>
          ) : (
            <div className="space-y-4">
              {summary.crossDomainCorrelations.map((corr) => (
                <Card key={corr.id} className="glass-panel p-5 border-amber-500/20 space-y-3">
                  <Flex justify="between" align="center">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-4xs font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {corr.severity}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">{corr.title}</h4>
                    </div>
                    <span className="text-4xs font-mono text-muted-foreground">
                      Confidence: {corr.confidence}
                    </span>
                  </Flex>

                  <p className="text-xs text-muted-foreground font-mono">{corr.description}</p>

                  <div className="p-3 rounded-lg bg-surface-light/40 border border-border/40 space-y-1 font-mono text-3xs">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-bold block">
                      Root Cause Hypothesis
                    </span>
                    <p className="text-foreground">{corr.rootCauseHypothesis}</p>
                  </div>

                  <Flex align="center" className="gap-2 pt-1">
                    <span className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Contributing Domains:
                    </span>
                    {corr.contributingDomains.map((d) => (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded text-4xs bg-surface border border-border text-accent uppercase font-mono"
                      >
                        {d}
                      </span>
                    ))}
                  </Flex>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tab: Release Scorecard & AI Narrative */}
        <TabsContent value="release">
          <div className="space-y-6">
            <Card className="glass-panel p-6 space-y-5">
              <Flex justify="between" align="center">
                <div>
                  <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
                    Deterministic Quality Scorecard
                  </span>
                  <h3 className="text-lg font-bold text-foreground">
                    Release Verdict:{' '}
                    {campaign.releaseVerdict ? (
                      <span className={`px-2.5 py-0.5 rounded text-xs border ${getVerdictBadgeClass(campaign.releaseVerdict)}`}>
                        {campaign.releaseVerdict.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-mono">--</span>
                    )}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
                    Calculated Score
                  </span>
                  <span className="text-2xl font-black font-mono text-foreground">
                    {formatScore(campaign.overallScore)}
                  </span>
                </div>
              </Flex>

              {/* Blockers List */}
              {summary?.releaseReadiness?.blockers && summary.releaseReadiness.blockers.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-4xs uppercase tracking-widest font-semibold text-rose-400 block">
                    Release Blockers ({summary.releaseReadiness.blockers.length})
                  </span>
                  <div className="space-y-2">
                    {summary.releaseReadiness.blockers.map((b) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs font-mono space-y-1"
                      >
                        <Flex justify="between" align="center">
                          <span className="font-bold text-rose-300">{b.title}</span>
                          <span className="text-4xs px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase">
                            {b.severity}
                          </span>
                        </Flex>
                        <p className="text-muted-foreground text-3xs">{b.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* AI Executive Advisory Narrative */}
            {summary?.aiExecutiveNarrative && (
              <Card className="glass-panel p-6 space-y-4 border-accent/20">
                <Flex justify="between" align="center">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-accent/10 text-accent">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    </span>
                    <h3 className="text-sm font-bold text-foreground">AI Executive QA Narrative (Advisory)</h3>
                  </div>
                  <span className="text-4xs font-mono text-muted-foreground uppercase">
                    Advisory Intelligence
                  </span>
                </Flex>

                <p className="text-xs text-foreground font-mono leading-relaxed">
                  {summary.aiExecutiveNarrative.overview}
                </p>

                {summary.aiExecutiveNarrative.keyHighlights?.length > 0 && (
                  <div className="space-y-1 font-mono text-3xs">
                    <span className="text-4xs uppercase tracking-wider text-emerald-400 font-semibold block">
                      Key Highlights
                    </span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {summary.aiExecutiveNarrative.keyHighlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.aiExecutiveNarrative.criticalConcerns?.length > 0 && (
                  <div className="space-y-1 font-mono text-3xs">
                    <span className="text-4xs uppercase tracking-wider text-rose-400 font-semibold block">
                      Critical Concerns
                    </span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {summary.aiExecutiveNarrative.criticalConcerns.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {summary.aiExecutiveNarrative.recommendedNextSteps?.length > 0 && (
                  <div className="space-y-1 font-mono text-3xs">
                    <span className="text-4xs uppercase tracking-wider text-sky-400 font-semibold block">
                      Recommended Next Steps
                    </span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {summary.aiExecutiveNarrative.recommendedNextSteps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Tab: Evidence Feed */}
        <TabsContent value="evidence">
          {evidence.length === 0 ? (
            <Card className="glass-panel p-8 text-center text-xs font-mono text-muted-foreground">
              No evidence records captured yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {evidence.map((ev) => (
                <Card key={ev.id} className="glass-panel p-4 space-y-1 font-mono text-xs">
                  <Flex justify="between" align="center">
                    <span className="font-bold text-foreground">{ev.title}</span>
                    <span className="px-2 py-0.5 rounded text-4xs bg-surface border border-border text-muted-foreground uppercase">
                      {ev.type}
                    </span>
                  </Flex>
                  {ev.message && <p className="text-3xs text-muted-foreground">{ev.message}</p>}
                  <span className="text-4xs text-muted-foreground/60 block pt-1">{ev.createdAt}</span>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Stack>
  );
}
