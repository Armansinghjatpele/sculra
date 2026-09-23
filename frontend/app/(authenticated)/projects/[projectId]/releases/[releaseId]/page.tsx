'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Stack, Grid, Flex } from '@/components/LayoutPrimitives';
import {
  Project,
  Release,
  ReleaseCheck,
  ReleaseDecision,
  ProjectEnvironment,
  Deployment,
} from '@/lib/demoData';
import {
  getProject,
  getProjectRelease,
  getProjectEnvironment,
  getReleaseChecks,
  getReleaseDecisions,
} from '@/services/db';

interface ReleaseDetailPageProps {
  params: Promise<{ projectId: string; releaseId: string }>;
}

export default function ReleaseCommandCenterPage({ params }: ReleaseDetailPageProps) {
  const resolvedParams = use(params);
  const { projectId, releaseId } = resolvedParams;
  const { getToken, orgRole } = useAuth();

  const [project, setProject] = React.useState<Project | null>(null);
  const [release, setRelease] = React.useState<Release | null>(null);
  const [environment, setEnvironment] = React.useState<ProjectEnvironment | null>(null);
  const [checks, setChecks] = React.useState<ReleaseCheck[]>([]);
  const [decisions, setDecisions] = React.useState<ReleaseDecision[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Evaluation states
  const [evaluating, setEvaluating] = React.useState(false);
  const [policyLevel, setPolicyLevel] = React.useState<'PERMISSIVE' | 'STANDARD' | 'STRICT'>('STANDARD');

  // Human decision form
  const [decisionAction, setDecisionAction] = React.useState<'APPROVE' | 'BLOCK' | 'REQUEST_RETEST'>('APPROVE');
  const [decisionNotes, setDecisionNotes] = React.useState('');
  const [deciding, setDeciding] = React.useState(false);
  const [decisionError, setDecisionError] = React.useState<string | null>(null);

  const isViewer = orgRole === 'viewer' || orgRole === 'org:viewer';

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (token) {
        const [proj, rel] = await Promise.all([
          getProject(token, projectId),
          getProjectRelease(token, projectId, releaseId),
        ]);
        setProject(proj);
        setRelease(rel);

        if (rel) {
          const [env, chks, decs] = await Promise.all([
            getProjectEnvironment(token, projectId, rel.environmentId),
            getReleaseChecks(token, releaseId),
            getReleaseDecisions(token, releaseId),
          ]);
          setEnvironment(env);
          setChecks(chks);
          setDecisions(decs);
        }
      }
    } catch (err) {
      console.error('[ReleaseCommandCenter Load Error]:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId, releaseId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/releases/${releaseId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyLevel }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed evaluating release check');
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleRecordDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    setDecisionError(null);
    setDeciding(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/releases/${releaseId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decisionAction,
          notes: decisionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed recording decision');
      }

      setDecisionNotes('');
      loadData();
    } catch (err: any) {
      setDecisionError(err.message || 'Decision failed');
    } finally {
      setDeciding(false);
    }
  };

  const latestCheck = checks[0] || null;

  const getGateBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-success/15 text-success border border-success/30">PASS</span>;
      case 'WARN':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-warning/15 text-warning border border-warning/30">WARN</span>;
      case 'FAIL':
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-danger/15 text-danger border border-danger/30">FAIL</span>;
      default:
        return <span className="px-2 py-0.5 text-3xs font-bold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">NOT MEASURED</span>;
    }
  };

  const getReleaseStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-success/15 text-success border border-success/40">READY</span>;
      case 'RELEASED':
        return <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/40">RELEASED</span>;
      case 'BLOCKED':
        return <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-danger/15 text-danger border border-danger/40">BLOCKED</span>;
      case 'TESTING':
        return <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/40">TESTING</span>;
      case 'ABANDONED':
        return <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">ABANDONED</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold uppercase rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/40">PENDING</span>;
    }
  };

  if (loading && !release) {
    return (
      <div className="p-12 text-center text-muted-foreground font-mono text-xs">
        Loading Release Command Center...
      </div>
    );
  }

  if (!release) {
    return (
      <div className="p-12 text-center font-mono text-xs space-y-4">
        <p className="text-danger">Release candidate not found.</p>
        <Link href={`/projects/${projectId}/releases`}>
          <Button variant="outline" size="sm">Back to Releases</Button>
        </Link>
      </div>
    );
  }

  return (
    <Stack spacing={24}>
      <PageHeader
        title={`Release Command Center — ${release.version}`}
        description={`Target: ${environment ? environment.name : release.environmentId} | Commit: ${release.commitSha.slice(0, 7)} | Branch: ${release.branch || 'main'}`}
        action={
          <div className="flex items-center gap-3">
            {getReleaseStatusBadge(release.status)}
            <Link href={`/projects/${projectId}/releases`}>
              <Button variant="outline" size="sm">All Releases</Button>
            </Link>
          </div>
        }
      />

      {/* Top Level KPI Grid */}
      <Grid cols={1} colsMd={4} gap={16}>
        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Readiness Score</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-foreground mt-1">
              {latestCheck?.overallScore !== null && latestCheck?.overallScore !== undefined
                ? `${latestCheck.overallScore.toFixed(1)}`
                : '--'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-4xs text-muted-foreground">
            {latestCheck ? `Policy: ${latestCheck.policyLevel}` : 'Awaiting gate evaluation'}
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Verdict</CardDescription>
            <CardTitle className={`text-xl font-bold mt-2 ${
              latestCheck?.releaseDecision === 'RELEASE' ? 'text-success' :
              latestCheck?.releaseDecision === 'WARN' ? 'text-warning' :
              latestCheck?.releaseDecision === 'BLOCK' ? 'text-danger' : 'text-zinc-400'
            }`}>
              {latestCheck?.releaseDecision || 'INSUFFICIENT_EVIDENCE'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-4xs text-muted-foreground">
            {latestCheck ? `${latestCheck.gates?.length || 0} gates assessed` : 'Zero fake pass metrics'}
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Critical Blockers</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-danger mt-1">
              {latestCheck?.evidenceSummary?.blockersCount !== undefined
                ? latestCheck.evidenceSummary.blockersCount
                : '--'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-4xs text-muted-foreground">
            Must be 0 to achieve PASS
          </CardContent>
        </Card>

        <Card className="glass-panel text-center py-4">
          <CardHeader className="p-0">
            <CardDescription className="text-4xs uppercase tracking-widest font-semibold">New Regressions</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-amber-400 mt-1">
              {latestCheck?.evidenceSummary?.regressionsCount !== undefined
                ? latestCheck.evidenceSummary.regressionsCount
                : '--'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 mt-2 text-4xs text-muted-foreground">
            Compared to baseline release
          </CardContent>
        </Card>
      </Grid>

      {/* Evaluation Trigger Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40 p-4 rounded-xl border border-white/5 font-mono text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-3xs uppercase tracking-wider">Policy Level:</span>
          <select
            value={policyLevel}
            onChange={(e: any) => setPolicyLevel(e.target.value)}
            className="bg-zinc-950 border border-white/10 rounded-lg px-3 py-1.5 text-foreground text-xs focus:outline-none focus:border-accent"
          >
            <option value="PERMISSIVE">PERMISSIVE (Relaxed thresholds)</option>
            <option value="STANDARD">STANDARD (Production default)</option>
            <option value="STRICT">STRICT (Zero tolerance)</option>
          </select>
        </div>

        <Button
          variant="accent"
          size="sm"
          onClick={handleRunEvaluation}
          disabled={evaluating || release.status === 'RELEASED'}
          className="inline-flex items-center gap-2"
        >
          {evaluating ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Evaluating Gates...</span>
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Evaluate 10 Release Gates</span>
            </>
          )}
        </Button>
      </div>

      {/* 10 Deterministic Gates Table */}
      <div className="space-y-4 font-mono">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Deterministic Release Gates (Prompt 38 Authority)
          </h3>
          <span className="text-3xs text-zinc-500">Evaluates actual evidence only. Never fabricates pass metrics.</span>
        </div>

        {!latestCheck || !latestCheck.gates || latestCheck.gates.length === 0 ? (
          <Card className="glass-panel p-8 text-center text-xs text-muted-foreground">
            No gate evaluation has been executed yet for {release.version}. Click &quot;Evaluate 10 Release Gates&quot; above to run the deterministic gate engine.
          </Card>
        ) : (
          <div className="border border-white/5 rounded-xl overflow-hidden bg-zinc-950/40">
            <div className="divide-y divide-white/5">
              {latestCheck.gates.map((g, idx) => (
                <div key={idx} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-xs text-foreground tracking-wide">{g.gate}</span>
                      {getGateBadge(g.status)}
                      {g.metricValue !== undefined && (
                        <span className="text-3xs text-accent">Value: {g.metricValue}</span>
                      )}
                    </div>
                    <p className="text-3xs text-muted-foreground">{g.reason}</p>
                  </div>

                  <div className="flex items-center gap-3 text-3xs text-zinc-500 self-end md:self-auto">
                    <span>Evidence items: {g.evidenceRefs?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Human Release Decision Panel */}
      <div className="space-y-4 font-mono">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Human Release Governance & Approvals
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Decision Form */}
          <div className="p-5 rounded-xl border border-white/5 bg-zinc-900/30 space-y-4 text-xs">
            <div className="border-b border-white/10 pb-3">
              <span className="font-bold text-foreground">Record Release Decision</span>
              <p className="text-3xs text-muted-foreground mt-0.5">
                Role authorization enforced: Viewers cannot record decisions.
              </p>
            </div>

            {decisionError && (
              <div className="p-3 bg-danger/10 border border-danger/30 text-danger rounded-lg text-3xs">
                {decisionError}
              </div>
            )}

            {release.status === 'RELEASED' ? (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 text-blue-300 rounded-lg text-3xs">
                ℹ️ This release is marked as RELEASED. Decisions cannot be altered.
              </div>
            ) : isViewer ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg text-3xs">
                🔒 You have VIEWER permissions. Release decision recording requires Developer, QA Lead, Admin, or Owner roles.
              </div>
            ) : (
              <form onSubmit={handleRecordDecision} className="space-y-4">
                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Decision *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecisionAction('APPROVE')}
                      className={`py-2 px-3 rounded-lg border text-3xs font-bold uppercase ${
                        decisionAction === 'APPROVE'
                          ? 'bg-success/20 border-success text-success'
                          : 'bg-zinc-950 border-white/10 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      Approve Release
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisionAction('BLOCK')}
                      className={`py-2 px-3 rounded-lg border text-3xs font-bold uppercase ${
                        decisionAction === 'BLOCK'
                          ? 'bg-danger/20 border-danger text-danger'
                          : 'bg-zinc-950 border-white/10 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      Block Release
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecisionAction('REQUEST_RETEST')}
                      className={`py-2 px-3 rounded-lg border text-3xs font-bold uppercase ${
                        decisionAction === 'REQUEST_RETEST'
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-zinc-950 border-white/10 text-muted-foreground hover:border-white/20'
                      }`}
                    >
                      Request Retest
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-3xs uppercase tracking-wider text-muted-foreground mb-1">Governance Notes / Audit Rationale</label>
                  <textarea
                    rows={3}
                    placeholder="Document release sign-off notes or reasons for gate override..."
                    value={decisionNotes}
                    onChange={(e) => setDecisionNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-white/10 rounded-lg p-3 text-foreground focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="accent" size="sm" disabled={deciding}>
                    {deciding ? 'Recording...' : 'Submit Decision'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Decision Audit Trail */}
          <div className="p-5 rounded-xl border border-white/5 bg-zinc-900/30 space-y-4 text-xs">
            <div className="border-b border-white/10 pb-3 flex justify-between items-center">
              <span className="font-bold text-foreground">Decision Audit Trail</span>
              <span className="text-3xs text-muted-foreground">{decisions.length} recorded</span>
            </div>

            {decisions.length === 0 ? (
              <p className="text-3xs text-muted-foreground p-6 text-center">
                No human decisions recorded yet for this release candidate.
              </p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {decisions.map((dec) => (
                  <div key={dec.id} className="p-3 bg-zinc-950 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-3xs">
                      <span className={`font-bold ${
                        dec.decision === 'APPROVE' ? 'text-success' :
                        dec.decision === 'BLOCK' ? 'text-danger' : 'text-amber-400'
                      }`}>
                        {dec.decision}
                      </span>
                      <span className="text-zinc-500">{new Date(dec.decidedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-3xs text-muted-foreground">
                      Decided by: <span className="text-foreground font-semibold">{dec.decidedBy}</span> ({dec.decidedByRole})
                    </div>
                    {dec.notes && (
                      <p className="text-3xs text-zinc-300 mt-1 italic">&quot;{dec.notes}&quot;</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Stack>
  );
}
