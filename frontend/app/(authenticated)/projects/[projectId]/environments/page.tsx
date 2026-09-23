'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Stack, Grid, Flex } from '@/components/LayoutPrimitives';
import { Project, ProjectEnvironment } from '@/lib/demoData';
import { getProject, getProjectEnvironments } from '@/services/db';

interface EnvironmentsPageProps {
  params: Promise<{ projectId: string }>;
}

export default function EnvironmentsPage({ params }: EnvironmentsPageProps) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId;
  const { getToken, orgRole } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [environments, setEnvironments] = React.useState<ProjectEnvironment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);

  // Form states
  const [envName, setEnvName] = React.useState('');
  const [envType, setEnvType] = React.useState<string>('PREVIEW');
  const [envBaseUrl, setEnvBaseUrl] = React.useState('');
  const [envBranch, setEnvBranch] = React.useState('');
  const [envCommitSha, setEnvCommitSha] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const isOwnerOrAdmin = orgRole === 'org:admin' || orgRole === 'admin' || orgRole === 'owner';

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const [proj, envs] = await Promise.all([
          getProject(token, projectId),
          getProjectEnvironments(token, projectId),
        ]);
        setProject(proj);
        setEnvironments(envs);
      }
    } catch (err) {
      console.error('[EnvironmentsPage Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateEnvironment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/environments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: envName,
          type: envType,
          baseUrl: envBaseUrl,
          branch: envBranch || undefined,
          commitSha: envCommitSha || undefined,
          isProduction: envType === 'PRODUCTION',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed creating environment');
      }

      setShowAddModal(false);
      setEnvName('');
      setEnvBaseUrl('');
      setEnvBranch('');
      setEnvCommitSha('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEnvironment = async (envId: string, isProduction: boolean) => {
    if (isProduction && !isOwnerOrAdmin) {
      alert('Production environments can only be removed by Organization Owners or Admins.');
      return;
    }
    if (!confirm('Are you sure you want to delete this environment?')) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/environments/${envId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed deleting environment');
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded bg-success/10 text-success border border-success/30">Healthy</span>;
      case 'DEGRADED':
        return <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded bg-warning/10 text-warning border border-warning/30">Degraded</span>;
      case 'UNREACHABLE':
        return <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded bg-danger/10 text-danger border border-danger/30">Unreachable</span>;
      case 'AUTH_REQUIRED':
        return <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">Auth Required</span>;
      default:
        return <span className="px-2 py-0.5 text-3xs font-bold uppercase rounded bg-white/10 text-muted-foreground border border-white/20">Unknown</span>;
    }
  };

  return (
    <Stack spacing={24}>
      <PageHeader
        title={project ? `${project.name} — Environments` : 'Project Environments'}
        description="Factual multi-environment control plane with strict SSRF defenses and production permission guards."
        action={
          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">Back to Project</Button>
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
              <span>Add Environment</span>
            </Button>
          </div>
        }
      />

      {/* Overview Cards */}
      <Grid cols={1} colsMd={4} gap={16}>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Total Environments</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground mt-1">{environments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Production Protected</CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-400 mt-1">
              {environments.filter((e) => e.isProduction).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Healthy</CardDescription>
            <CardTitle className="text-2xl font-bold text-success mt-1">
              {environments.filter((e) => e.healthStatus === 'HEALTHY').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">SSRF Protection</CardDescription>
            <CardTitle className="text-sm font-bold text-emerald-400 mt-2">ACTIVE (RFC 1918 Blocked)</CardTitle>
          </CardHeader>
        </Card>
      </Grid>

      {/* Environments List */}
      <div className="space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Configured Environments</h3>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground font-mono text-xs">Loading environments...</div>
        ) : environments.length === 0 ? (
          <Card className="glass-panel p-8 text-center font-mono text-xs text-muted-foreground">
            No environments configured. Click &quot;Add Environment&quot; to register staging, preview, or production targets.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {environments.map((env) => (
              <div
                key={env.id}
                className={`p-5 rounded-xl border transition-colors ${
                  env.isProduction ? 'bg-amber-950/10 border-amber-500/30' : 'bg-zinc-900/40 border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-foreground">{env.name}</span>
                      <span className="px-2 py-0.5 text-3xs font-mono font-bold rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {env.type}
                      </span>
                      {env.isProduction && (
                        <span className="px-2 py-0.5 text-3xs font-mono font-bold uppercase tracking-wider rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          🛡️ Production Guard
                        </span>
                      )}
                      {getHealthBadge(env.healthStatus)}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="text-zinc-500">URL:</span>
                        <a href={env.baseUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {env.baseUrl}
                        </a>
                      </span>
                      {env.branch && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-zinc-500">Branch:</span>
                          <span className="text-foreground">{env.branch}</span>
                        </span>
                      )}
                      {env.commitSha && (
                        <span className="flex items-center gap-1.5">
                          <span className="text-zinc-500">SHA:</span>
                          <span className="text-foreground">{env.commitSha.slice(0, 7)}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="text-right hidden sm:block">
                      <div className="text-muted-foreground text-3xs uppercase">Latency</div>
                      <div className="text-foreground font-bold">
                        {env.metadata?.lastValidationLatencyMs ? `${env.metadata.lastValidationLatencyMs} ms` : '--'}
                      </div>
                    </div>
                    <Link href={`/projects/${projectId}/deployments?environmentId=${env.id}`}>
                      <Button variant="outline" size="sm" className="font-mono text-3xs">
                        Deployments
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteEnvironment(env.id, env.isProduction)}
                      className="font-mono text-3xs text-danger/80 hover:text-danger hover:border-danger/30"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Environment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Register Environment</h3>
                <p className="text-3xs text-muted-foreground mt-0.5">Define target environment URL for deployment and QA orchestration.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground text-lg">×</button>
            </div>

            {formError && (
              <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-lg text-3xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateEnvironment} className="space-y-4">
              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Environment Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staging V2, Production, PR-104 Preview"
                  value={envName}
                  onChange={(e) => setEnvName(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Environment Type *</label>
                  <select
                    value={envType}
                    onChange={(e) => setEnvType(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  >
                    <option value="PREVIEW">PREVIEW</option>
                    <option value="STAGING">STAGING</option>
                    <option value="PRODUCTION">PRODUCTION</option>
                    <option value="DEVELOPMENT">DEVELOPMENT</option>
                    <option value="CANARY">CANARY</option>
                    <option value="EPHEMERAL">EPHEMERAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Target Branch</label>
                  <input
                    type="text"
                    placeholder="e.g. main, develop"
                    value={envBranch}
                    onChange={(e) => setEnvBranch(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Base URL (SSRF Protected) *</label>
                <input
                  type="url"
                  required
                  placeholder="https://staging.example.com"
                  value={envBaseUrl}
                  onChange={(e) => setEnvBaseUrl(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
                <p className="text-4xs text-zinc-500 mt-1">
                  SSRF Policy: Localhost, 127.0.0.1, RFC 1918 subnets, and cloud metadata (169.254.169.254) are rejected.
                </p>
              </div>

              <div>
                <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Initial Commit SHA (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 6d8b2a1e"
                  value={envCommitSha}
                  onChange={(e) => setEnvCommitSha(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              {envType === 'PRODUCTION' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-3xs text-amber-300">
                  ⚠️ Note: Registering or modifying a PRODUCTION environment requires Organization Owner or Admin privileges.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" size="sm" disabled={submitting}>
                  {submitting ? 'Registering...' : 'Save Environment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Stack>
  );
}
