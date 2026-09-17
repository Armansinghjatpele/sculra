'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stack, Flex, Grid } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Campaign, CampaignObjective, CampaignDomain, Project } from '@/lib/demoData';
import { getProject, getProjectCampaigns } from '@/services/db';
import {
  getObjectiveLabel,
  getCampaignStatusBadgeClass,
  getVerdictBadgeClass,
  formatDuration,
  formatScore,
} from '@/lib/campaignUtils';

interface CampaignsPageProps {
  params: Promise<{ projectId: string }>;
}

const ALL_DOMAINS: { id: CampaignDomain; label: string; description: string }[] = [
  { id: 'discovery', label: 'Discovery & Crawl', description: 'Deep application topology & link mapping' },
  { id: 'product', label: 'Product Model', description: 'Feature & business workflow synthesis' },
  { id: 'strategy', label: 'Strategy Engine', description: 'Risk-weighted target prioritization' },
  { id: 'journey', label: 'User Journeys', description: 'Deterministic user workflows & form automation' },
  { id: 'visual', label: 'Visual & Responsive', description: 'Multi-device viewports & UI regression checks' },
  { id: 'auth', label: 'Auth & Roles', description: 'Multi-role permission matrix & session isolation' },
  { id: 'api', label: 'API & Backend', description: 'Endpoint contracts, payload fuzzing, status checks' },
  { id: 'security', label: 'Security & Auth', description: 'Headers, cookies, CORS, sensitive data leak checks' },
  { id: 'performance', label: 'Performance', description: 'Core Web Vitals, navigation timings, TTFB' },
  { id: 'accessibility', label: 'Accessibility (a11y)', description: 'WCAG 2.1 AA/AAA compliance, contrast, ARIA' },
  { id: 'historical', label: 'Historical QA Memory', description: 'Cross-run regressions, stability, recurrence detection' },
  { id: 'release', label: 'Release Readiness', description: 'Authoritative risk scoring & release gate evaluation' },
];

export default function ProjectCampaignsPage({ params }: CampaignsPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;

  const { getToken } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  // Modal State
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Form State
  const [campaignName, setCampaignName] = React.useState('');
  const [objective, setObjective] = React.useState<CampaignObjective>('RELEASE_GATE');
  const [selectedDomains, setSelectedDomains] = React.useState<Set<CampaignDomain>>(
    new Set(ALL_DOMAINS.map((d) => d.id))
  );
  const [targetUrl, setTargetUrl] = React.useState('');
  const [targetRole, setTargetRole] = React.useState('');
  const [maxDurationSeconds, setMaxDurationSeconds] = React.useState(600);
  const [maxTasks, setMaxTasks] = React.useState(25);
  const [maxParallelStages, setMaxParallelStages] = React.useState(2);
  const [adaptiveInsertion, setAdaptiveInsertion] = React.useState(true);
  const [minReleaseScoreThreshold, setMinReleaseScoreThreshold] = React.useState(80);

  const fetchCampaigns = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const [proj, camps] = await Promise.all([
          getProject(token, projectId),
          getProjectCampaigns(token, projectId),
        ]);
        setProject(proj);
        setCampaigns(camps);
        if (proj?.url) {
          setTargetUrl(proj.url);
        }
      }
    } catch (err) {
      console.error('[Campaigns Page Load Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId]);

  React.useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const toggleDomain = (domain: CampaignDomain) => {
    const updated = new Set(selectedDomains);
    if (updated.has(domain)) {
      if (updated.size > 1) {
        updated.delete(domain);
      }
    } else {
      updated.add(domain);
    }
    setSelectedDomains(updated);
  };

  const selectAllDomains = () => {
    setSelectedDomains(new Set(ALL_DOMAINS.map((d) => d.id)));
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: campaignName || `${project?.name || 'Project'} — ${getObjectiveLabel(objective)} Campaign`,
          objective,
          enabledDomains: Array.from(selectedDomains),
          targetUrl: targetUrl || project?.url,
          targetRole: targetRole || undefined,
          budget: {
            maxDurationSeconds,
            maxTasks,
            maxParallelStages,
            maxRetriesPerTask: 1,
          },
          adaptiveInsertion,
          minReleaseScoreThreshold,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create campaign');
      }

      setShowCreateModal(false);
      // Automatically trigger execution
      if (data.campaign?.id) {
        await fetch(`/api/campaigns/${data.campaign.id}/start`, { method: 'POST' });
        router.push(`/campaigns/${data.campaign.id}`);
      } else {
        await fetchCampaigns();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Error initializing campaign.');
    } finally {
      setCreating(false);
    }
  };

  const filteredCampaigns = React.useMemo(() => {
    if (statusFilter === 'ALL') return campaigns;
    return campaigns.filter((c) => c.status === statusFilter);
  }, [campaigns, statusFilter]);

  return (
    <Stack spacing={24}>
      <PageHeader
        title={`${project?.name || 'Project'} — QA Campaigns`}
        description="Autonomous multi-stage QA control plane executing unified cross-domain test campaigns."
        action={
          <Flex align="center" className="gap-3">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">Back to Project</Button>
            </Link>
            <Button
              variant="accent"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>New QA Campaign</span>
            </Button>
          </Flex>
        }
      />

      {/* Campaign Highlights Cards */}
      <Grid cols={1} colsMd={4} gap={16}>
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Total Campaigns
          </span>
          <span className="text-2xl font-black text-foreground font-mono">{campaigns.length}</span>
        </Card>
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Active / Running
          </span>
          <span className="text-2xl font-black text-sky-400 font-mono">
            {campaigns.filter((c) => c.status === 'RUNNING' || c.status === 'PENDING').length}
          </span>
        </Card>
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Passed Release Gates
          </span>
          <span className="text-2xl font-black text-emerald-400 font-mono">
            {campaigns.filter((c) => c.releaseVerdict === 'RELEASE').length}
          </span>
        </Card>
        <Card className="glass-panel p-5">
          <span className="text-4xs uppercase tracking-widest font-semibold text-muted-foreground block mb-1">
            Blocked Releases
          </span>
          <span className="text-2xl font-black text-rose-400 font-mono">
            {campaigns.filter((c) => c.releaseVerdict === 'DO_NOT_RELEASE').length}
          </span>
        </Card>
      </Grid>

      {/* Filter Tabs */}
      <Flex justify="between" align="center" className="border-b border-border/40 pb-3">
        <Flex className="gap-2">
          {['ALL', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-mono rounded-lg transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-accent/20 text-accent font-semibold border border-accent/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-light'
              }`}
            >
              {st}
            </button>
          ))}
        </Flex>
      </Flex>

      {/* Campaigns Table */}
      {loading ? (
        <div className="py-16 text-center text-sm font-mono text-muted-foreground">
          Loading QA campaigns...
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="glass-panel p-12 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-foreground">No QA Campaigns Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Launch your first autonomous end-to-end QA campaign to orchestrate discovery, user journeys, API, security, performance, accessibility, and release readiness.
          </p>
          <Button variant="accent" size="sm" onClick={() => setShowCreateModal(true)}>
            Launch First Campaign
          </Button>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50 bg-surface/50">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-surface-light/40 border-b border-border/50 text-muted-foreground">
              <tr>
                <th className="p-3.5 pl-4">Campaign Name</th>
                <th className="p-3.5">Objective</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Stage</th>
                <th className="p-3.5">Release Verdict</th>
                <th className="p-3.5">Score</th>
                <th className="p-3.5">Created</th>
                <th className="p-3.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30 text-foreground">
              {filteredCampaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-surface-light/30 transition-colors">
                  <td className="p-3.5 pl-4 font-medium text-foreground">
                    <Link
                      href={`/campaigns/${camp.id}`}
                      className="hover:text-accent font-semibold flex items-center gap-2"
                    >
                      <span>{camp.name}</span>
                    </Link>
                  </td>
                  <td className="p-3.5 text-muted-foreground">{getObjectiveLabel(camp.objective)}</td>
                  <td className="p-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-4xs font-bold uppercase border ${getCampaignStatusBadgeClass(camp.status)}`}>
                      {camp.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-muted-foreground">{camp.currentStage}</td>
                  <td className="p-3.5">
                    {camp.releaseVerdict ? (
                      <span className={`inline-flex px-2 py-0.5 rounded text-4xs font-bold uppercase border ${getVerdictBadgeClass(camp.releaseVerdict)}`}>
                        {camp.releaseVerdict}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3.5 font-bold">
                    {camp.overallScore !== undefined && camp.overallScore !== null ? (
                      <span className={camp.overallScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                        {formatScore(camp.overallScore)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">--</span>
                    )}
                  </td>
                  <td className="p-3.5 text-muted-foreground">{camp.createdAt}</td>
                  <td className="p-3.5 pr-4 text-right">
                    <Link href={`/campaigns/${camp.id}`}>
                      <Button variant="outline" size="sm" className="text-3xs py-1 px-2.5">
                        Open Control Plane
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Campaign Launch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <Flex justify="between" align="center" className="border-b border-border/40 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Launch Autonomous QA Campaign</h2>
                <p className="text-xs text-muted-foreground">
                  Configure multi-domain campaign objective, engine boundaries, and runtime budget.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-lg font-bold"
              >
                ✕
              </button>
            </Flex>

            {createError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCampaign} className="space-y-5">
              {/* Campaign Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Campaign Name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder={`e.g. ${project?.name || 'App'} — Release Readiness Gate`}
                  className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Objective Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Campaign Objective</label>
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as CampaignObjective)}
                  className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="RELEASE_GATE">Release Gate (Comprehensive pre-deployment validation)</option>
                  <option value="FULL_REGRESSION">Full Regression (Deep audit across all capabilities)</option>
                  <option value="SMOKE">Smoke Test (Fast critical path verification)</option>
                  <option value="SECURITY_SWEEP">Security Sweep (Vulnerability & Auth matrix focus)</option>
                  <option value="PERFORMANCE_AUDIT">Performance Audit (Web Vitals & Network audit)</option>
                  <option value="ACCESSIBILITY_AUDIT">Accessibility Audit (WCAG 2.1 compliance)</option>
                  <option value="TARGETED_RETEST">Targeted Retest (Historical regressions & flaky targets)</option>
                  <option value="EXPLORATORY">Exploratory QA (Autonomous multi-path discovery)</option>
                </select>
              </div>

              {/* Target Website URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Target URL</label>
                <input
                  type="url"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-surface-light border border-border rounded-lg text-xs font-mono text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {/* Enabled Domains Multi-select */}
              <div className="space-y-2">
                <Flex justify="between" align="center">
                  <label className="text-xs font-medium text-foreground">
                    Active QA Domains ({selectedDomains.size}/{ALL_DOMAINS.length})
                  </label>
                  <button
                    type="button"
                    onClick={selectAllDomains}
                    className="text-3xs text-accent hover:underline font-mono"
                  >
                    Select All
                  </button>
                </Flex>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-border/40 rounded-xl bg-surface-light/30">
                  {ALL_DOMAINS.map((domain) => (
                    <label
                      key={domain.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                        selectedDomains.has(domain.id)
                          ? 'bg-accent/10 border-accent/30 text-foreground'
                          : 'bg-transparent border-transparent text-muted-foreground opacity-60 hover:opacity-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDomains.has(domain.id)}
                        onChange={() => toggleDomain(domain.id)}
                        className="mt-0.5 rounded border-border text-accent focus:ring-0"
                      />
                      <div>
                        <span className="text-xs font-bold block">{domain.label}</span>
                        <span className="text-4xs text-muted-foreground block">{domain.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Budget Parameters */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-surface-light/40 border border-border/40 rounded-xl">
                <div className="space-y-1">
                  <label className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Max Duration
                  </label>
                  <select
                    value={maxDurationSeconds}
                    onChange={(e) => setMaxDurationSeconds(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono"
                  >
                    <option value={120}>2 minutes (Fast)</option>
                    <option value={300}>5 minutes</option>
                    <option value={600}>10 minutes (Standard)</option>
                    <option value={1200}>20 minutes (Deep)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Max Tasks
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={maxTasks}
                    onChange={(e) => setMaxTasks(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-4xs uppercase tracking-wider text-muted-foreground font-semibold">
                    Score Gate Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minReleaseScoreThreshold}
                    onChange={(e) => setMinReleaseScoreThreshold(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-surface border border-border rounded text-xs font-mono"
                  />
                </div>
              </div>

              {/* Adaptive Dynamic Task Insertion Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adaptiveInsertion}
                  onChange={(e) => setAdaptiveInsertion(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-0"
                />
                <span className="text-xs text-foreground font-medium">
                  Enable adaptive dynamic task insertion (schedules targeted re-tests upon failure signals)
                </span>
              </label>

              {/* Modal Actions */}
              <Flex justify="end" className="gap-3 border-t border-border/40 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  size="sm"
                  disabled={creating}
                  className="inline-flex items-center gap-1.5"
                >
                  {creating ? 'Launching Campaign...' : 'Launch Campaign'}
                </Button>
              </Flex>
            </form>
          </div>
        </div>
      )}
    </Stack>
  );
}
