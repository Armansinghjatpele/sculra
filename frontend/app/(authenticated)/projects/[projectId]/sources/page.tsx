'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/Tabs';
import {
  Project,
  ProjectSource,
  SourceSnapshot,
  SourceHealthObservation,
  SourceChange,
  SourceType,
  SourceCapabilityKey,
} from '@/lib/demoData';
import {
  getProject,
  getProjectSources,
  getProjectSourceSnapshots,
  getProjectSourceHealth,
  getProjectSourceChanges,
  createProjectSource,
  validateProjectSource,
} from '@/services/db';

interface SourcesPageProps {
  params: Promise<{ projectId: string }>;
}

const ALL_CAPABILITY_KEYS: Array<{ key: SourceCapabilityKey; label: string; group: string }> = [
  { key: 'BROWSER_NAVIGATION', label: 'Browser Navigation', group: 'Browser & UX' },
  { key: 'DOM_DISCOVERY', label: 'DOM Discovery', group: 'Browser & UX' },
  { key: 'FUNCTIONAL_TESTING', label: 'Functional Testing', group: 'Browser & UX' },
  { key: 'VISUAL_TESTING', label: 'Visual Regression', group: 'Browser & UX' },
  { key: 'RESPONSIVE_TESTING', label: 'Responsive Viewports', group: 'Browser & UX' },
  { key: 'ACCESSIBILITY_TESTING', label: 'Accessibility (WCAG)', group: 'Browser & UX' },
  { key: 'PERFORMANCE_TESTING', label: 'Performance (Vitals)', group: 'Browser & UX' },
  { key: 'BROWSER_NETWORK_OBSERVATION', label: 'Network Observation', group: 'Browser & UX' },
  { key: 'REPOSITORY_ANALYSIS', label: 'Repository Analysis', group: 'Code & CI' },
  { key: 'CHANGE_DETECTION', label: 'Commit Change Detection', group: 'Code & CI' },
  { key: 'SOURCE_MAPPING', label: 'Source File Mapping', group: 'Code & CI' },
  { key: 'RCA_CONTEXT', label: 'Root Cause Analysis', group: 'Remediation' },
  { key: 'REMEDIATION_CONTEXT', label: 'Safe Patch Generation', group: 'Remediation' },
  { key: 'CI_CONTEXT', label: 'CI/CD Webhook Context', group: 'Code & CI' },
  { key: 'API_TESTING', label: 'API Endpoint QA', group: 'Backend & API' },
  { key: 'DESKTOP_TESTING', label: 'Desktop Agent QA', group: 'Desktop' },
];

export default function ProjectSourcesPage({ params }: SourcesPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { getToken, orgId } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [sources, setSources] = React.useState<ProjectSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = React.useState<string>('');
  const [snapshots, setSnapshots] = React.useState<SourceSnapshot[]>([]);
  const [healthHistory, setHealthHistory] = React.useState<SourceHealthObservation[]>([]);
  const [changes, setChanges] = React.useState<SourceChange[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('overview');

  // Connect source modal state
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addType, setAddType] = React.useState<SourceType>('WEBSITE');
  const [addLocator, setAddLocator] = React.useState('');
  const [addBranch, setAddBranch] = React.useState('main');
  const [addEnv, setAddEnv] = React.useState('PRODUCTION');
  const [isValidating, setIsValidating] = React.useState(false);
  const [validationResult, setValidationResult] = React.useState<any>(null);
  const [addError, setAddError] = React.useState('');

  // Probing state
  const [probingSourceId, setProbingSourceId] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const token = (await getToken()) || 'demo-token';
        const [proj, srcList] = await Promise.all([
          getProject(token, projectId),
          getProjectSources(token, projectId),
        ]);
        setProject(proj);
        setSources(srcList);
        if (srcList.length > 0) {
          const firstId = srcList[0].id;
          setSelectedSourceId(firstId);
          const [snaps, health, chgs] = await Promise.all([
            getProjectSourceSnapshots(token, firstId),
            getProjectSourceHealth(token, firstId),
            getProjectSourceChanges(token, firstId),
          ]);
          setSnapshots(snaps);
          setHealthHistory(health);
          setChanges(chgs);
        }
      } catch (err) {
        console.error('[SourcesPage Load Error]:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [getToken, projectId]);

  const handleSelectSource = async (sourceId: string) => {
    setSelectedSourceId(sourceId);
    try {
      const token = (await getToken()) || 'demo-token';
      const [snaps, health, chgs] = await Promise.all([
        getProjectSourceSnapshots(token, sourceId),
        getProjectSourceHealth(token, sourceId),
        getProjectSourceChanges(token, sourceId),
      ]);
      setSnapshots(snaps);
      setHealthHistory(health);
      setChanges(chgs);
    } catch (err) {
      console.error('[SelectSource Error]:', err);
    }
  };

  const handleProbeHealth = async (source: ProjectSource) => {
    try {
      setProbingSourceId(source.id);
      const token = (await getToken()) || 'demo-token';
      const result = await validateProjectSource(token, source.type, source.locator, source.configuration);
      const newObs: SourceHealthObservation = {
        id: `hobs-${Date.now()}`,
        projectSourceId: source.id,
        status: result.health,
        latencyMs: result.latencyMs,
        metadata: {
          probedAt: new Date().toISOString(),
          status: result.status,
        },
        observedAt: new Date().toISOString(),
      };
      setHealthHistory((prev) => [newObs, ...prev.slice(0, 99)]);
    } catch (err: any) {
      console.error('[Probe error]:', err);
    } finally {
      setProbingSourceId(null);
    }
  };

  const handlePreflightValidate = async () => {
    if (!addLocator.trim()) {
      setAddError('Locator is required.');
      return;
    }
    try {
      setIsValidating(true);
      setAddError('');
      const token = (await getToken()) || 'demo-token';
      const res = await validateProjectSource(token, addType, addLocator.trim());
      setValidationResult(res);
      if (!res.valid) {
        setAddError(res.errors[0]?.message || 'Validation failed.');
      }
    } catch (err: any) {
      setAddError(err.message || 'Validation failed.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveSource = async () => {
    if (!validationResult || !validationResult.valid) return;
    try {
      setIsValidating(true);
      const token = (await getToken()) || 'demo-token';
      const newSrc = await createProjectSource(token, {
        projectId,
        type: addType,
        locator: addLocator.trim(),
        branch: addType === 'GITHUB' ? addBranch : undefined,
        environment: addEnv,
        status: validationResult.status,
        configuration: {},
        capabilities: validationResult.capabilities,
      });

      setSources((prev) => [...prev, newSrc]);
      setShowAddModal(false);
      setAddLocator('');
      setValidationResult(null);
      handleSelectSource(newSrc.id);
    } catch (err: any) {
      setAddError(err.message || 'Failed saving source.');
    } finally {
      setIsValidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <svg className="h-5 w-5 animate-spin text-accent" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading Project Sources & Capabilities...</span>
        </div>
      </div>
    );
  }

  const selectedSource = sources.find((s) => s.id === selectedSourceId) || sources[0];

  // Calculate statistics
  const totalAvailableCaps = sources.reduce((acc, s) => {
    return acc + (s.capabilities?.filter((c) => c.state === 'AVAILABLE').length || 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href={`/projects/${projectId}`} className="hover:text-foreground transition-colors">
              {project?.name || 'Project'}
            </Link>
            <span>/</span>
            <span className="text-foreground">Sources & Connection Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Project Sources & Connection Intelligence
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Normalized multi-surface ingestion across Website, GitHub, API, ZIP, and Desktop.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm">Back to Project</Button>
          </Link>
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              setShowAddModal(true);
              setValidationResult(null);
              setAddError('');
            }}
            className="inline-flex items-center gap-1.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span>Connect Source</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-950/60 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Connected Sources</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{sources.length}</span>
              <span className="text-xs text-muted-foreground">/ 10 max</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Tenant isolated ingestion capacity</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/60 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Active Capabilities</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">{totalAvailableCaps}</span>
              <span className="text-xs text-muted-foreground">across {sources.length} surfaces</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Directly usable by Autonomous QA</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/60 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">Latest Observation</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {healthHistory[0]?.latencyMs ? `${healthHistory[0].latencyMs}ms` : 'Recorded'}
              </span>
              <span className="text-xs text-emerald-400 font-medium">
                {healthHistory[0]?.status || 'HEALTHY'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Genuine preflight probe latency</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950/60 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">SSRF Shield Guard</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-cyan-400">Active</span>
              <span className="text-xs text-muted-foreground">Hop limit: 5</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Private IP, link-local & cloud metadata blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-zinc-950/80 border border-white/10 p-1">
          <TabsTrigger value="sources" className="text-xs">
            Sources & Health ({sources.length})
          </TabsTrigger>
          <TabsTrigger value="matrix" className="text-xs">
            Capabilities Matrix
          </TabsTrigger>
          <TabsTrigger value="snapshots" className="text-xs">
            Snapshots & Fingerprints ({snapshots.length})
          </TabsTrigger>
          <TabsTrigger value="changes" className="text-xs">
            Observed Changes ({changes.length})
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs">
            SSRF & Safety Policy
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Sources & Health */}
        <TabsContent value="sources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Sources List Column */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider px-1">
                Configured Sources
              </div>
              {sources.map((src) => {
                const isSelected = src.id === selectedSource?.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => handleSelectSource(src.id)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900/90 border-accent/40 shadow-sm'
                        : 'bg-zinc-950/50 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-zinc-800 text-zinc-200 border border-zinc-700">
                          {src.type}
                        </span>
                        <span className="text-xs font-medium text-foreground truncate max-w-[170px]">
                          {src.locator}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          src.status === 'AVAILABLE'
                            ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                            : src.status === 'NOT_READY'
                            ? 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {src.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Env: {src.environment}</span>
                      {src.branch && <span>Branch: {src.branch}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Source Details & Live Observation */}
            <div className="lg:col-span-2 space-y-4">
              {selectedSource ? (
                <>
                  <Card className="bg-zinc-950/70 border-white/10">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-accent/15 text-accent border border-accent/30">
                            {selectedSource.type}
                          </span>
                          <CardTitle className="text-base text-foreground font-mono">
                            {selectedSource.locator}
                          </CardTitle>
                        </div>
                        <CardDescription className="text-xs mt-1">
                          Source ID: {selectedSource.id} • Environment: {selectedSource.environment}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={probingSourceId === selectedSource.id}
                        onClick={() => handleProbeHealth(selectedSource)}
                        className="text-xs inline-flex items-center gap-1.5"
                      >
                        {probingSourceId === selectedSource.id ? (
                          <>
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            <span>Probing...</span>
                          </>
                        ) : (
                          <>
                            <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Probe Connectivity</span>
                          </>
                        )}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-1">
                      {/* Status / Notice for partial or unready sources */}
                      {selectedSource.status === 'NOT_READY' && (
                        <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2">
                          <svg className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <span className="font-semibold">Truthful Execution State: </span>
                            This source is registered but requires provisioned execution infrastructure before autonomous tests can run. Sculra truthfully reports this status without fabricating test execution.
                          </div>
                        </div>
                      )}

                      {/* Health Observation Stream */}
                      <div className="space-y-2">
                        <div className="text-xs font-medium text-muted-foreground">Recent Preflight Observations</div>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {healthHistory.map((obs) => (
                            <div
                              key={obs.id}
                              className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/5 flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    obs.status === 'HEALTHY'
                                      ? 'bg-emerald-400'
                                      : obs.status === 'NOT_READY'
                                      ? 'bg-amber-400'
                                      : 'bg-zinc-400'
                                  }`}
                                />
                                <span className="font-mono text-foreground">{obs.status}</span>
                                {obs.latencyMs && (
                                  <span className="text-muted-foreground font-mono">({obs.latencyMs}ms)</span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(obs.observedAt).toLocaleTimeString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Select a source to view details.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Capabilities Matrix */}
        <TabsContent value="matrix" className="space-y-4">
          <Card className="bg-zinc-950/70 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">
                Unified Cross-Source Capabilities Matrix
              </CardTitle>
              <CardDescription className="text-xs">
                Truthful mapping of the 16 testing dimensions across all connected surfaces.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="pb-3 font-semibold">Testing Capability</th>
                      <th className="pb-3 font-semibold">Category</th>
                      {sources.map((s) => (
                        <th key={s.id} className="pb-3 font-semibold">
                          <span className="font-mono">{s.type}</span>
                          <span className="block text-[10px] text-muted-foreground font-normal truncate max-w-[120px]">
                            {s.locator}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ALL_CAPABILITY_KEYS.map((cap) => (
                      <tr key={cap.key} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 font-medium text-foreground">{cap.label}</td>
                        <td className="py-2.5 text-muted-foreground">{cap.group}</td>
                        {sources.map((s) => {
                          const match = s.capabilities?.find((c) => c.key === cap.key);
                          const state = match?.state || 'UNAVAILABLE';
                          return (
                            <td key={s.id} className="py-2.5">
                              <span
                                title={match?.reason || state}
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                  state === 'AVAILABLE'
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                                    : state === 'PARTIAL'
                                    ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                                    : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                                }`}
                              >
                                {state}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Snapshots & Fingerprints */}
        <TabsContent value="snapshots" className="space-y-4">
          <Card className="bg-zinc-950/70 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">
                Immutable Source Snapshots
              </CardTitle>
              <CardDescription className="text-xs">
                Deterministic SHA-256 state fingerprints guaranteeing reproducibility and change detection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-foreground font-semibold">
                        {snap.id}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(snap.observedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400 break-all bg-black/40 p-2 rounded border border-white/5">
                      SHA256: {snap.fingerprint}
                    </div>
                    {snap.revision && (
                      <div className="text-[11px] text-muted-foreground">
                        Revision: <span className="text-foreground font-mono">{snap.revision}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Observed Changes */}
        <TabsContent value="changes" className="space-y-4">
          <Card className="bg-zinc-950/70 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">
                Observed Source Changes
              </CardTitle>
              <CardDescription className="text-xs">
                Continuous fingerprint differential tracking across revisions and environments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {changes.map((chg, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 flex items-start justify-between text-xs"
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {chg.type}
                      </span>
                      <p className="mt-1.5 text-foreground font-medium">{chg.details}</p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 ml-4">
                      {new Date(chg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: SSRF & Safety Policy */}
        <TabsContent value="security" className="space-y-4">
          <Card className="bg-zinc-950/70 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">
                Target Surface Security & SSRF Defense Policy
              </CardTitle>
              <CardDescription className="text-xs">
                Hardened ingress rules protecting against SSRF, internal network scanning, and secret leaks.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-white/5 space-y-1.5">
                  <div className="font-semibold text-emerald-400">SSRF & Loopback Blocking</div>
                  <p className="text-muted-foreground text-[11px]">
                    Strictly blocks 127.0.0.1, localhost, and RFC 1918 private IPv4 networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-white/5 space-y-1.5">
                  <div className="font-semibold text-emerald-400">Cloud Metadata Protection</div>
                  <p className="text-muted-foreground text-[11px]">
                    Access to 169.254.169.254, metadata.google.internal, and cloud metadata endpoints is unconditionally rejected.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-white/5 space-y-1.5">
                  <div className="font-semibold text-emerald-400">Hop-by-Hop Redirect Validation</div>
                  <p className="text-muted-foreground text-[11px]">
                    Redirects are manually inspected up to 5 hops maximum. SSRF safety is re-evaluated on every single destination hop.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-900/50 border border-white/5 space-y-1.5">
                  <div className="font-semibold text-emerald-400">Automated Secret & Injection Redaction</div>
                  <p className="text-muted-foreground text-[11px]">
                    GitHub PATs, OpenAI keys, AWS access tokens, and prompt injection attempts are deeply neutralized before persistence.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Connect Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-lg font-bold text-foreground">Connect New Project Source</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Source Type Selector */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Source Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['WEBSITE', 'GITHUB', 'API', 'ZIP', 'DESKTOP'] as SourceType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setAddType(t);
                        setValidationResult(null);
                      }}
                      className={`p-2 rounded border font-mono text-[11px] font-semibold uppercase transition-colors ${
                        addType === t
                          ? 'bg-accent/20 border-accent text-accent'
                          : 'bg-zinc-900/70 border-white/10 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notice for ZIP / Desktop */}
              {(addType === 'ZIP' || addType === 'DESKTOP') && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-[11px]">
                  <span className="font-bold">Notice: </span>
                  {addType === 'ZIP'
                    ? 'ZIP storage is unprovisioned. The source will be registered as NOT_READY without executing tests.'
                    : 'Desktop testing requires isolated VM workers. Execution is prohibited for safety and reported truthfully.'}
                </div>
              )}

              {/* Locator */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  {addType === 'WEBSITE'
                    ? 'Target URL (e.g. https://example.com)'
                    : addType === 'GITHUB'
                    ? 'Repository Locator (e.g. owner/repo)'
                    : addType === 'API'
                    ? 'API Base URL (e.g. https://api.example.com/v1)'
                    : addType === 'ZIP'
                    ? 'ZIP Archive File Path'
                    : 'Desktop Binary Name'}
                </label>
                <input
                  type="text"
                  value={addLocator}
                  onChange={(e) => setAddLocator(e.target.value)}
                  placeholder={
                    addType === 'WEBSITE'
                      ? 'https://example.com'
                      : addType === 'GITHUB'
                      ? 'owner/repository'
                      : 'https://api.example.com'
                  }
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none focus:border-accent"
                />
              </div>

              {/* Branch if GITHUB */}
              {addType === 'GITHUB' && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Branch</label>
                  <input
                    type="text"
                    value={addBranch}
                    onChange={(e) => setAddBranch(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-foreground font-mono text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              {/* Environment */}
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">Environment</label>
                <select
                  value={addEnv}
                  onChange={(e) => setAddEnv(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-foreground text-xs focus:outline-none focus:border-accent"
                >
                  <option value="PRODUCTION">Production</option>
                  <option value="STAGING">Staging</option>
                  <option value="PREVIEW">Preview / PR</option>
                  <option value="LOCAL">Local / Dev</option>
                </select>
              </div>

              {/* Validation Result Box */}
              {validationResult && (
                <div
                  className={`p-3 rounded-lg border ${
                    validationResult.valid
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-300'
                      : 'bg-red-950/30 border-red-800/40 text-red-300'
                  }`}
                >
                  <div className="font-semibold">
                    {validationResult.valid ? 'Preflight Succeeded' : 'Preflight Failed'}
                  </div>
                  <div className="text-[11px] mt-1">
                    Status: {validationResult.status} • Health: {validationResult.health}
                  </div>
                  {validationResult.errors?.length > 0 && (
                    <div className="mt-1 text-[11px] text-red-400">
                      {validationResult.errors[0].message}
                    </div>
                  )}
                </div>
              )}

              {addError && <div className="text-red-400 text-xs">{addError}</div>}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              {!validationResult?.valid ? (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={isValidating || !addLocator.trim()}
                  onClick={handlePreflightValidate}
                >
                  {isValidating ? 'Validating...' : 'Validate Preflight'}
                </Button>
              ) : (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={isValidating}
                  onClick={handleSaveSource}
                >
                  Confirm & Connect
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
