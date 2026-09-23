'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Stack, Grid, Flex } from '@/components/LayoutPrimitives';
import { Project, Release, ProjectEnvironment, Deployment } from '@/lib/demoData';
import {
  getProject,
  getProjectReleases,
  getProjectEnvironments,
  getProjectDeployments,
} from '@/services/db';

interface ReleasesPageProps {
  params: Promise<{ projectId: string }>;
}

export default function ReleasesPage({ params }: ReleasesPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { getToken } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [releases, setReleases] = React.useState<Release[]>([]);
  const [environments, setEnvironments] = React.useState<ProjectEnvironment[]>([]);
  const [deployments, setDeployments] = React.useState<Deployment[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Create Release Modal
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [version, setVersion] = React.useState('');
  const [environmentId, setEnvironmentId] = React.useState('');
  const [deploymentId, setDeploymentId] = React.useState('');
  const [commitSha, setCommitSha] = React.useState('');
  const [branch, setBranch] = React.useState('');
  const [previousReleaseId, setPreviousReleaseId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const [proj, rels, envs, deps] = await Promise.all([
          getProject(token, projectId),
          getProjectReleases(token, projectId),
          getProjectEnvironments(token, projectId),
          getProjectDeployments(token, projectId),
        ]);
        setProject(proj);
        setReleases(rels);
        setEnvironments(envs);
        setDeployments(deps);
        if (envs.length > 0 && !environmentId) {
          setEnvironmentId(envs[0].id);
        }
      }
    } catch (err) {
      console.error('[ReleasesPage Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId, environmentId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/releases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: version.trim(),
          environmentId,
          deploymentId: deploymentId || undefined,
          commitSha: commitSha.trim(),
          branch: branch.trim() || undefined,
          previousReleaseId: previousReleaseId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed creating release');
      }

      setShowAddModal(false);
      setVersion('');
      setCommitSha('');
      setBranch('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getReleaseStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <span className="px-2.5 py-1 text-3xs font-bold uppercase rounded bg-success/15 text-success border border-success/40">READY</span>;
      case 'RELEASED':
        return <span className="px-2.5 py-1 text-3xs font-bold uppercase rounded bg-blue-500/15 text-blue-400 border border-blue-500/40">RELEASED</span>;
      case 'BLOCKED':
        return <span className="px-2.5 py-1 text-3xs font-bold uppercase rounded bg-danger/15 text-danger border border-danger/40">BLOCKED</span>;
      case 'TESTING':
        return <span className="px-2.5 py-1 text-3xs font-bold uppercase rounded bg-purple-500/15 text-purple-400 border border-purple-500/40">TESTING</span>;
      case 'ABANDONED':
        return <span className="px-2.5 py-1 text-3xs font-bold uppercase rounded bg-zinc-800 text-zinc-400 border border-zinc-700">ABANDONED</span>;
      default:
        return <span className="px-2.5 py-1 text-3xs font-bold uppercase rounded bg-amber-500/15 text-amber-400 border border-amber-500/40">PENDING</span>;
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
        title={project ? `${project.name} — Releases` : 'Release Registry'}
        description="Release candidates evaluated against 10 deterministic gates, factual environment health, and cross-release regression checks."
        action={
          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}/environments`}>
              <Button variant="outline" size="sm">Environments</Button>
            </Link>
            <Link href={`/projects/${projectId}/deployments`}>
              <Button variant="outline" size="sm">Deployments</Button>
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
              <span>New Release Candidate</span>
            </Button>
          </div>
        }
      />

      {/* Metrics Row */}
      <Grid cols={1} colsMd={4} gap={16}>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Total Releases</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground mt-1">{releases.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Ready for Release</CardDescription>
            <CardTitle className="text-2xl font-bold text-success mt-1">
              {releases.filter((r) => r.status === 'READY').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Blocked</CardDescription>
            <CardTitle className="text-2xl font-bold text-danger mt-1">
              {releases.filter((r) => r.status === 'BLOCKED').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Released</CardDescription>
            <CardTitle className="text-2xl font-bold text-blue-400 mt-1">
              {releases.filter((r) => r.status === 'RELEASED').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </Grid>

      {/* Releases List */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Release Candidates</h3>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground font-mono text-xs">Loading release registry...</div>
        ) : releases.length === 0 ? (
          <Card className="glass-panel p-8 text-center font-mono text-xs text-muted-foreground">
            No releases recorded. Click &quot;New Release Candidate&quot; to initialize release gate verification.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 font-mono">
            {releases.map((rel) => {
              const env = envLookup.get(rel.environmentId);
              return (
                <div
                  key={rel.id}
                  className="p-5 rounded-xl border border-white/5 bg-zinc-900/40 hover:border-white/10 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-base text-foreground">{rel.version}</span>
                        {getReleaseStatusBadge(rel.status)}
                        <span className="text-xs text-muted-foreground">
                          Target Environment: <span className="text-foreground font-semibold">{env ? env.name : rel.environmentId}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Commit: <span className="text-foreground font-semibold">{rel.commitSha.slice(0, 7)}</span>
                        </span>
                        {rel.branch && (
                          <span>
                            Branch: <span className="text-accent">{rel.branch}</span>
                          </span>
                        )}
                        {rel.previousReleaseId && (
                          <span>
                            Baseline: <span className="text-zinc-400">{rel.previousReleaseId}</span>
                          </span>
                        )}
                        <span>
                          Created: {new Date(rel.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link href={`/projects/${projectId}/releases/${rel.id}`}>
                        <Button variant="accent" size="sm" className="font-mono text-3xs">
                          Open Command Center →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Release Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">New Release Candidate</h3>
                <p className="text-3xs text-muted-foreground mt-0.5">Initialize release candidate for gate evaluation and regression checking.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>

            {formError && (
              <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-lg text-3xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateRelease} className="space-y-4">
              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Version / Tag *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v2.4.1-rc.1, 2026.09.20"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Target Environment *</label>
                <select
                  required
                  value={environmentId}
                  onChange={(e) => setEnvironmentId(e.target.value)}
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
                    placeholder="e.g. a8b3c4d5"
                    value={commitSha}
                    onChange={(e) => setCommitSha(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. develop, main"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Linked Deployment (Optional)</label>
                <select
                  value={deploymentId}
                  onChange={(e) => setDeploymentId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">None / Not Deployed Yet</option>
                  {deployments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id} ({d.status}) — SHA: {d.commitSha.slice(0, 7)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Baseline Comparison Release (Optional)</label>
                <select
                  value={previousReleaseId}
                  onChange={(e) => setPreviousReleaseId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="">None (Initial Baseline)</option>
                  {releases.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.version} ({r.status}) — SHA: {r.commitSha.slice(0, 7)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Candidate'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Stack>
  );
}
