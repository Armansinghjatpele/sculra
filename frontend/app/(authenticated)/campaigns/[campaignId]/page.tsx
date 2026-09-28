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
  const [decisions, setDecisions] = React.useState<any[]>([]);

  // Polling data
  const loadCampaignData = React.useCallback(async () => {
    try {
      const [campRes, tasksRes, evRes, decRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch(`/api/campaigns/${campaignId}/tasks`),
        fetch(`/api/campaigns/${campaignId}/evidence`),
        fetch(`/api/campaigns/${campaignId}/decisions`),
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

      if (decRes && decRes.ok) {
        const decData = await decRes.json();
        if (decData.success && decData.decisions) {
          setDecisions(decData.decisions);
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

      {/* Change Intelligence & Context Banner */}
      {(campaign.config?.commitHash || summary?.changeIntelligence) && (
        <Card className="glass-panel p-5 border-sky-500/30 bg-sky-500/5 space-y-3">
          <Flex justify="between" align="center" className="flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </span>
              <div>
                <span className="text-4xs uppercase tracking-widest font-semibold text-sky-400 block">
                  Change-Aware Continuous QA
                </span>
                <div className="flex items-center gap-2 font-mono text-xs text-foreground">
                  <span className="font-bold">Commit:</span>
                  <span className="text-sky-300 font-bold">{campaign.config?.commitHash?.slice(0, 8) || 'HEAD'}</span>
                  {campaign.config?.branch && (
                    <span className="text-muted-foreground">({campaign.config.branch})</span>
                  )}
                  {summary?.changeIntelligence?.riskLevel && (
                    <span className={`px-2 py-0.5 rounded text-4xs font-bold uppercase border ${
                      summary.changeIntelligence.riskLevel === 'CRITICAL'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                        : summary.changeIntelligence.riskLevel === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      Risk {summary.changeIntelligence.riskScore}/100 ({summary.changeIntelligence.riskLevel})
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-3xs font-mono text-muted-foreground">
              {summary?.changeIntelligence?.changeCount !== undefined && (
                <span><strong>{summary.changeIntelligence.changeCount}</strong> files changed</span>
              )}
              {summary?.changeIntelligence?.additionsCount !== undefined && (
                <span className="text-emerald-400">+{summary.changeIntelligence.additionsCount}</span>
              )}
              {summary?.changeIntelligence?.deletionsCount !== undefined && (
                <span className="text-rose-400">-{summary.changeIntelligence.deletionsCount}</span>
              )}
            </div>
          </Flex>

          {/* Impacted Surfaces */}
          {summary?.changeIntelligence && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-sky-500/20 text-3xs font-mono">
              <div className="text-muted-foreground truncate">
                <span className="text-foreground font-bold">Routes: </span>
                {summary.changeIntelligence.affectedRoutes?.length > 0 ? summary.changeIntelligence.affectedRoutes.join(', ') : 'None affected'}
              </div>
              <div className="text-muted-foreground truncate">
                <span className="text-foreground font-bold">Workflows: </span>
                {summary.changeIntelligence.affectedWorkflows?.length > 0 ? summary.changeIntelligence.affectedWorkflows.join(', ') : 'None affected'}
              </div>
              <div className="text-muted-foreground truncate">
                <span className="text-foreground font-bold">APIs: </span>
                {summary.changeIntelligence.affectedApis?.length > 0 ? summary.changeIntelligence.affectedApis.join(', ') : 'None affected'}
              </div>
            </div>
          )}
        </Card>
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
          <TabsTrigger value="regressions">
            Change & Regressions ({summary?.regressionComparison?.totalCompared ?? (summary?.regressionsCount ? (summary.regressionsCount + (summary.recoveriesCount || 0)) : decisions.length)})
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

        {/* Tab: Change & Regressions */}
        {/* Tab: Change & Regressions */}
        <TabsContent value="regressions">
          <div className="space-y-6">
            {/* Multi-Environment & Cross-Branch Intelligence (Prompt 61) */}
            {(summary?.branchComparison || summary?.environmentSnapshot || summary?.environmentComparison) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cross-Branch Intelligence */}
                {summary?.branchComparison && (
                  <Card className="glass-panel p-5 border-border/50 bg-surface/40 space-y-3">
                    <Flex justify="between" align="center">
                      <div>
                        <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-0.5">
                          Cross-Branch Intelligence
                        </span>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span className="text-cyan-400 font-mono">{summary.branchComparison.baseBranch}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-indigo-400 font-mono">{summary.branchComparison.headBranch}</span>
                        </h4>
                      </div>
                      <div className="text-right font-mono text-3xs text-muted-foreground">
                        <span>{summary.branchComparison.changedFilesCount} changed files</span>
                      </div>
                    </Flex>

                    {(summary.branchComparison.baseCommit || summary.branchComparison.headCommit) && (
                      <div className="flex items-center gap-2 text-3xs font-mono text-muted-foreground">
                        {summary.branchComparison.baseCommit && (
                          <span className="px-1.5 py-0.5 rounded bg-surface border border-border">
                            base: {summary.branchComparison.baseCommit}
                          </span>
                        )}
                        {summary.branchComparison.headCommit && (
                          <span className="px-1.5 py-0.5 rounded bg-surface border border-border">
                            head: {summary.branchComparison.headCommit}
                          </span>
                        )}
                      </div>
                    )}

                    {summary.branchComparison.affectedAreas && summary.branchComparison.affectedAreas.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-4xs uppercase tracking-wider text-muted-foreground">Affected Areas:</span>
                        <div className="flex flex-wrap gap-1">
                          {summary.branchComparison.affectedAreas.map((area: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-surface-light border border-border/40 text-4xs text-foreground font-mono">
                              {area}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                )}

                {/* Multi-Environment Runtime & Drift */}
                {(summary?.environmentSnapshot || summary?.environmentComparison) && (
                  <Card className="glass-panel p-5 border-border/50 bg-surface/40 space-y-3">
                    <Flex justify="between" align="center">
                      <div>
                        <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-0.5">
                          Multi-Environment Runtime
                        </span>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-3xs font-mono font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            {summary?.environmentSnapshot?.environmentName || 'STAGING'}
                          </span>
                          {summary?.environmentSnapshot?.environmentType && (
                            <span className="text-3xs text-muted-foreground">({summary.environmentSnapshot.environmentType})</span>
                          )}
                        </h4>
                      </div>
                      {summary?.environmentComparison?.driftDetected && (
                        <span className="px-2 py-0.5 rounded text-4xs font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          Drift Detected
                        </span>
                      )}
                    </Flex>

                    {summary?.environmentComparison?.driftTypes && summary.environmentComparison.driftTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {summary.environmentComparison.driftTypes.map((dt: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded text-4xs font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            {dt.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}

                    {summary?.environmentSnapshot?.targetUrl && (
                      <p className="text-3xs font-mono text-muted-foreground truncate">
                        Target: {summary.environmentSnapshot.targetUrl}
                      </p>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="glass-panel p-4 border-rose-500/30 bg-rose-500/5">
                <span className="text-4xs uppercase tracking-widest font-semibold text-rose-400 block mb-1">
                  Regressions Detected
                </span>
                <span className="text-2xl font-black font-mono text-rose-400">
                  {summary?.regressionComparison?.regressionsCount ?? summary?.regressionsCount ?? 0}
                </span>
              </Card>

              <Card className="glass-panel p-4 border-emerald-500/30 bg-emerald-500/5">
                <span className="text-4xs uppercase tracking-widest font-semibold text-emerald-400 block mb-1">
                  Recovered Defects
                </span>
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {summary?.regressionComparison?.recoveriesCount ?? summary?.recoveriesCount ?? 0}
                </span>
              </Card>

              <Card className="glass-panel p-4 border-amber-500/30 bg-amber-500/5">
                <span className="text-4xs uppercase tracking-widest font-semibold text-amber-400 block mb-1">
                  New / Persisting Failures
                </span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {(summary?.regressionComparison?.newFailuresCount || 0) + (summary?.regressionComparison?.persistingFailuresCount || 0)}
                </span>
              </Card>

              <Card className="glass-panel p-4 border-border/40">
                <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
                  Unchanged Passing
                </span>
                <span className="text-2xl font-black font-mono text-foreground">
                  {summary?.regressionComparison?.unchangedPassCount ?? tasks.filter((t) => t.status === 'COMPLETED').length}
                </span>
              </Card>
            </div>

            {/* Regression Comparison Table (Previous Baseline vs Current) */}
            <Card className="glass-panel p-6 space-y-4">
              <div>
                <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
                  Dimensional Regression Comparator (Baseline vs Current Run)
                </span>
                <h4 className="text-sm font-bold text-foreground">Target-by-Target Behavioral Diff</h4>
              </div>

              {!summary?.regressionComparison?.targets || summary.regressionComparison.targets.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-muted-foreground bg-surface/40 rounded-xl border border-border/40">
                  No historical regression comparison recorded for this campaign run.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border/50 bg-surface/50">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-surface-light/40 border-b border-border/50 text-muted-foreground">
                      <tr>
                        <th className="p-3 pl-4">Target Identifier</th>
                        <th className="p-3">Domain</th>
                        <th className="p-3">Baseline</th>
                        <th className="p-3">Current</th>
                        <th className="p-3">Classification</th>
                        <th className="p-3 pr-4">Analysis / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 text-foreground">
                      {summary.regressionComparison.targets.map((tgt: any, idx: number) => {
                        const isRegression = tgt.classification === 'REGRESSION';
                        const isRecovered = tgt.classification === 'RECOVERED';
                        const isNewFail = tgt.classification === 'NEW_FAILURE';
                        const isPersisting = tgt.classification === 'PERSISTING_FAILURE';

                        return (
                          <tr key={idx} className="hover:bg-surface-light/30 transition-colors">
                            <td className="p-3 pl-4 font-semibold text-foreground truncate max-w-xs">
                              {tgt.targetIdentifier}
                            </td>
                            <td className="p-3 text-muted-foreground text-3xs uppercase">
                              {tgt.domain}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-4xs font-bold uppercase border ${
                                tgt.baselineStatus === 'PASSED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : tgt.baselineStatus === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-surface-light text-muted-foreground border-border/40'
                              }`}>
                                {tgt.baselineStatus}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-4xs font-bold uppercase border ${
                                tgt.currentStatus === 'PASSED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                              }`}>
                                {tgt.currentStatus}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-4xs font-bold uppercase border ${
                                isRegression
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                  : isRecovered
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : isNewFail
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : isPersisting
                                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                                  : 'bg-surface-light text-muted-foreground border-border/40'
                              }`}>
                                {tgt.classification}
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-muted-foreground text-3xs leading-relaxed max-w-md">
                              {tgt.reason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Multi-Environment Cross-Environment Observations & Drift (Prompt 61) */}
            {summary?.environmentComparison?.targets && summary.environmentComparison.targets.length > 0 && (
              <Card className="glass-panel p-6 space-y-4">
                <div>
                  <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
                    Multi-Environment Regression Matrix (
                    {summary.environmentComparison.baseEnvironment?.environmentName || 'BASELINE'} vs{' '}
                    {summary.environmentComparison.targetEnvironment?.environmentName || 'TARGET'})
                  </span>
                  <h4 className="text-sm font-bold text-foreground">Cross-Environment Behavioral Observations</h4>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border/50 bg-surface/50">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-surface-light/40 border-b border-border/50 text-muted-foreground">
                      <tr>
                        <th className="p-3 pl-4">Target</th>
                        <th className="p-3">Domain</th>
                        <th className="p-3">{summary.environmentComparison.baseEnvironment?.environmentName || 'Baseline'}</th>
                        <th className="p-3">{summary.environmentComparison.targetEnvironment?.environmentName || 'Target'}</th>
                        <th className="p-3">Classification</th>
                        <th className="p-3 pr-4">Analysis / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30 text-foreground">
                      {summary.environmentComparison.targets.map((tgt: any, idx: number) => {
                        const isEnvFailure = tgt.classification === 'ENVIRONMENT_SPECIFIC_FAILURE';
                        const isCrossReg = tgt.classification === 'CROSS_ENVIRONMENT_REGRESSION';
                        const isDrift = tgt.classification?.includes('DRIFT');

                        return (
                          <tr key={idx} className="hover:bg-surface-light/30 transition-colors">
                            <td className="p-3 pl-4 font-semibold text-foreground truncate max-w-xs">
                              {tgt.targetIdentifier}
                            </td>
                            <td className="p-3 text-muted-foreground text-3xs uppercase">
                              {tgt.domain}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-4xs font-bold uppercase border ${
                                tgt.baseObservation?.status === 'PASSED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : tgt.baseObservation?.status === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-surface-light text-muted-foreground border-border/40'
                              }`}>
                                {tgt.baseObservation?.status || 'N/A'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-4xs font-bold uppercase border ${
                                tgt.targetObservation?.status === 'PASSED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : tgt.targetObservation?.status === 'FAILED'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-surface-light text-muted-foreground border-border/40'
                              }`}>
                                {tgt.targetObservation?.status || 'N/A'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex px-2 py-0.5 rounded text-4xs font-bold uppercase border ${
                                isCrossReg || isEnvFailure
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : isDrift
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-surface-light text-muted-foreground border-border/40'
                              }`}>
                                {tgt.classification?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-muted-foreground text-3xs leading-relaxed max-w-md">
                              {tgt.reason}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Autonomous Change Decisions Audit Log ("Why Tested / Why Skipped") */}
            <Card className="glass-panel p-6 space-y-4">
              <div>
                <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
                  Autonomous Decision Engine Audit Trail
                </span>
                <h4 className="text-sm font-bold text-foreground">Why Tested & Why Skipped Determinations</h4>
              </div>

              {(!decisions || decisions.length === 0) && (!summary?.changeDecisions || summary.changeDecisions.length === 0) ? (
                <div className="p-6 text-center text-xs font-mono text-muted-foreground bg-surface/40 rounded-xl border border-border/40">
                  No autonomous decisions recorded for this campaign run.
                </div>
              ) : (
                <div className="space-y-3">
                  {(decisions.length > 0 ? decisions : (summary?.changeDecisions || [])).map((dec: any) => {
                    const isTest = dec.decision === 'TEST';
                    const isSkip = dec.decision === 'SKIP';
                    const isDefer = dec.decision === 'DEFER';
                    const hasOverride = dec.criticalOverride || dec.metadata?.criticalOverride;

                    return (
                      <div
                        key={dec.id}
                        className={`p-4 rounded-xl border text-xs font-mono space-y-2 transition-all ${
                          hasOverride
                            ? 'bg-purple-500/5 border-purple-500/30'
                            : isTest
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : isSkip
                            ? 'bg-surface-light/40 border-border/40 opacity-85'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        <Flex justify="between" align="center" className="flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-4xs font-bold uppercase border ${
                                hasOverride
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                  : isTest
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : isSkip
                                  ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {dec.decision}
                            </span>
                            <span className="font-bold text-foreground">
                              {dec.entityId || dec.targetIdentifier}
                            </span>
                            {dec.environmentName && (
                              <span className="px-1.5 py-0.5 rounded text-4xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                {dec.environmentName}
                              </span>
                            )}
                            {dec.reuseClassification && (
                              <span className={`px-2 py-0.5 rounded text-4xs font-bold uppercase border ${
                                dec.reuseClassification === 'REUSE'
                                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                  : dec.reuseClassification === 'RERUN'
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}>
                                {dec.reuseClassification}
                              </span>
                            )}
                            {hasOverride && (
                              <span className="px-2 py-0.5 rounded text-4xs font-bold uppercase bg-purple-500/30 text-purple-200 border border-purple-500/50">
                                CRITICAL WORKFLOW OVERRIDE
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-4xs text-muted-foreground">
                            {dec.confidence && <span>Confidence: {dec.confidence}</span>}
                            {dec.skipReason && (
                              <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-amber-400">
                                Skip Reason: {dec.skipReason}
                              </span>
                            )}
                          </div>
                        </Flex>

                        <p className="text-muted-foreground text-3xs leading-relaxed">
                          {dec.reason}
                        </p>

                        {dec.reuseJustification && (
                          <p className="text-3xs text-teal-400/90 italic">
                            Reuse Justification: {dec.reuseJustification}
                          </p>
                        )}

                        {dec.evidence && dec.evidence.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {dec.evidence.map((evStr: string, i: number) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-surface-light/50 border border-border/30 text-4xs text-muted-foreground"
                              >
                                {evStr}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
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
