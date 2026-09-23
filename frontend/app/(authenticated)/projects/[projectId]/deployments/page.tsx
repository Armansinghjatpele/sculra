'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Stack, Grid, Flex } from '@/components/LayoutPrimitives';
import { Project, Deployment, ProjectEnvironment } from '@/lib/demoData';
import { getProject, getProjectDeployments, getProjectEnvironments } from '@/services/db';

interface DeploymentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default function DeploymentsPage({ params }: DeploymentsPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const searchParams = useSearchParams();
  const envFilter = searchParams.get('environmentId') || '';

  const { getToken } = useAuth();
  const [project, setProject] = React.useState<Project | null>(null);
  const [environments, setEnvironments] = React.useState<ProjectEnvironment[]>([]);
  const [deployments, setDeployments] = React.useState<Deployment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedEnv, setSelectedEnv] = React.useState<string>(envFilter);

  // Record deployment modal
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [targetEnvId, setTargetEnvId] = React.useState('');
  const [commitSha, setCommitSha] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [deploymentUrl, setDeploymentUrl] = React.useState('');
  const [trigger, setTrigger] = React.useState<string>('MANUAL');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const [proj, envs, deps] = await Promise.all([
          getProject(token, projectId),
          getProjectEnvironments(token, projectId),
          getProjectDeployments(token, projectId, selectedEnv || undefined),
        ]);
        setProject(proj);
        setEnvironments(envs);
        setDeployments(deps);
        if (envs.length > 0 && !targetEnvId) {
          setTargetEnvId(envs[0].id);
        }
      }
    } catch (err) {
      console.error('[DeploymentsPage Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId, selectedEnv, targetEnvId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordDeployment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/deployments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environmentId: targetEnvId,
          commitSha,
          branch: branch || undefined,
          deploymentUrl: deploymentUrl || undefined,
          trigger,
          status: 'SUCCEEDED',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed recording deployment');
      }

      setShowAddModal(false);
      setCommitSha('');
      setBranch('');
      setDeploymentUrl('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-success/10 text-success border border-success/30">SUCCEEDED</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-danger/10 text-danger border border-danger/30">FAILED</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">IN_PROGRESS</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-warning/10 text-warning border border-warning/30">PENDING</span>;
    }
  };

  const envLookup = React.useMemo(() => {
    const map = new Map<string, ProjectEnvironment>();
    environments.forEach((e) => map.set(e.id, e));
    return map;
  }, [environments]);

  return (
    <Stack spacing={24}>
      <PageHeader
        title={project ? `${project.name} — Deployments` : 'Deployments'}
        description="Factual deployment registry. Code changes do not qualify as deployments until deployment confirmation is verified."
        action={
          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}/environments`}>
              <Button variant="outline" size="sm">Environments</Button>
            </Link>
            <Link href={`/projects/${projectId}/releases`}>
              <Button variant="outline" size="sm">Releases</Button>
            </Link>
            <Button
              variant="accent"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Record Deployment</span>
            </Button>
          </div>
        }
      />

      {/* Filter and stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-white/5 font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-3xs uppercase tracking-wider">Filter Environment:</span>
          <select
            value={selectedEnv}
            onChange={(e) => setSelectedEnv(e.target.value)}
            className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:border-accent"
          >
            <option value="">All Environments ({environments.length})</option>
            {environments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.type})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-6 text-3xs text-muted-foreground">
          <div>Total Deployments: <span className="text-foreground font-bold">{deployments.length}</span></div>
          <div>Succeeded: <span className="text-success font-bold">{deployments.filter((d) => d.status === 'SUCCEEDED').length}</span></div>
          <div>Failed: <span className="text-danger font-bold">{deployments.filter((d) => d.status === 'FAILED').length}</span></div>
        </div>
      </div>

      {/* Deployments List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground font-mono text-xs">Loading deployments...</div>
        ) : deployments.length === 0 ? (
          <Card className="glass-panel p-8 text-center font-mono text-xs text-muted-foreground">
            No deployments recorded for this selection. When CI/CD or push events deploy an artifact, records will appear here.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 font-mono">
            {deployments.map((dep) => {
              const env = envLookup.get(dep.environmentId);
              return (
                <div
                  key={dep.id}
                  className="p-5 rounded-xl border border-white/5 bg-zinc-900/30 hover:border-white/10 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-foreground">{dep.id}</span>
                        {getStatusBadge(dep.status)}
                        <span className="px-2 py-0.5 text-3xs font-bold rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {dep.trigger}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Target: <span className="text-foreground font-semibold">{env ? env.name : dep.environmentId}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Commit: <span className="text-foreground font-semibold">{dep.commitSha.slice(0, 7)}</span>
                        </span>
                        {dep.branch && (
                          <span>
                            Branch: <span className="text-accent">{dep.branch}</span>
                          </span>
                        )}
                        {dep.deploymentUrl && (
                          <span>
                            URL: <a href={dep.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{dep.deploymentUrl}</a>
                          </span>
                        )}
                        <span>
                          Provider: <span className="text-zinc-400">{dep.provider}</span>
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <div>Recorded: {new Date(dep.createdAt).toLocaleString()}</div>
                      {dep.completedAt && dep.startedAt && (
                        <div className="text-3xs text-zinc-500 mt-1">
                          Duration: {Math.round((new Date(dep.completedAt).getTime() - new Date(dep.startedAt).getTime()) / 1000)}s
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Deployment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Record Deployment</h3>
                <p className="text-3xs text-muted-foreground mt-0.5">Register confirmed deployment of a git SHA to an environment.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>

            {formError && (
              <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-lg text-3xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleRecordDeployment} className="space-y-4">
              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Target Environment *</label>
                <select
                  required
                  value={targetEnvId}
                  onChange={(e) => setTargetEnvId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  {environments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.type}) — {e.baseUrl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Commit SHA *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 6d8b2a1e"
                    value={commitSha}
                    onChange={(e) => setCommitSha(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Deployment URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://preview-12.example.com"
                  value={deploymentUrl}
                  onChange={(e) => setDeploymentUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Trigger Method</label>
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="MANUAL">MANUAL</option>
                  <option value="GITHUB_PUSH">GITHUB_PUSH</option>
                  <option value="GITHUB_PR">GITHUB_PR</option>
                  <option value="WEBHOOK">WEBHOOK</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={submitting}>
                  {submitting ? 'Recording...' : 'Save Deployment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Stack>
  );
}
