'use client';

// ==============================================================================
// Sculra Project Fix Agent Remediation Dashboard
// (frontend/app/(authenticated)/projects/[projectId]/fixes/page.tsx)
// ==============================================================================

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Stack, Flex, Grid } from '@/components/LayoutPrimitives';
import { FixAgentPanel } from '@/components/FixAgentPanel';
import {
  FixRemediation,
  ProjectFixPolicy,
  Project,
  FixAgentMode,
} from '@/lib/demoData';
import {
  Wrench,
  ShieldCheck,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  ExternalLink,
  ChevronRight,
  Settings2,
  Sliders,
  Check,
  Sparkles,
} from 'lucide-react';

export default function ProjectFixesPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  const [loading, setLoading] = React.useState(true);
  const [remediations, setRemediations] = React.useState<FixRemediation[]>([]);
  const [policy, setPolicy] = React.useState<ProjectFixPolicy | null>(null);
  const [project, setProject] = React.useState<Project | null>(null);
  const [selectedRemediation, setSelectedRemediation] = React.useState<FixRemediation | null>(null);

  // Policy edit form state
  const [showSettings, setShowSettings] = React.useState(false);
  const [savingPolicy, setSavingPolicy] = React.useState(false);
  const [policySuccess, setPolicySuccess] = React.useState<string | null>(null);
  const [policyError, setPolicyError] = React.useState<string | null>(null);
  const [agentEnabled, setAgentEnabled] = React.useState(false);
  const [agentMode, setAgentMode] = React.useState<FixAgentMode>('PLAN_ONLY');
  const [maxFiles, setMaxFiles] = React.useState(10);
  const [maxDiffLines, setMaxDiffLines] = React.useState(500);
  const [requireApproval, setRequireApproval] = React.useState(true);
  const [allowedPathsStr, setAllowedPathsStr] = React.useState('');
  const [blockedTestCommandsStr, setBlockedTestCommandsStr] = React.useState('');

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`/api/projects/${projectId}/fixes`);
      if (res.ok) {
        const data = await res.json();
        if (data.remediations) {
          setRemediations(data.remediations);
          if (data.remediations.length > 0 && !selectedRemediation) {
            setSelectedRemediation(data.remediations[0]);
          }
        }
        if (data.policy) {
          setPolicy(data.policy);
          setAgentEnabled(!!data.policy.fixAgentEnabled);
          setAgentMode(data.policy.fixAgentMode || 'PLAN_ONLY');
          setMaxFiles(data.policy.fixMaxFilesChanged ?? 10);
          setMaxDiffLines(data.policy.fixMaxDiffLines ?? 500);
          setRequireApproval(data.policy.fixRequireHumanApproval !== false);
          setAllowedPathsStr((data.policy.fixAllowedPaths || []).join(', '));
        }
        if (data.project) {
          setProject(data.project);
        }
      }
    } catch (err) {
      console.error('Error loading fixes page data:', err);
    } finally {
      setLoading(false);
    }
  }, [getToken, projectId, selectedRemediation]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPolicy(true);
      setPolicySuccess(null);
      setPolicyError(null);

      const token = await getToken();
      if (!token) return;

      const allowedPaths = allowedPathsStr
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      const res = await fetch(`/api/projects/${projectId}/fixes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixAgentEnabled: agentEnabled,
          fixAgentMode: agentMode,
          fixMaxFilesChanged: Number(maxFiles),
          fixMaxDiffLines: Number(maxDiffLines),
          fixRequireHumanApproval: requireApproval,
          fixAllowedPaths: allowedPaths,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed updating fix agent policy');
      }

      setPolicy(data.policy);
      setPolicySuccess('Remediation policy updated successfully.');
      setTimeout(() => setPolicySuccess(null), 3000);
    } catch (err: any) {
      setPolicyError(err.message || 'Failed saving policy');
    } finally {
      setSavingPolicy(false);
    }
  };

  // Compute metrics from actual stored remediations
  const totalRemediations = remediations.length;
  const passedVerifications = remediations.filter(
    (r) => r.verificationStatus === 'PASSED'
  ).length;
  const prsOpened = remediations.filter((r) => r.pullRequestNumber || r.status === 'PR_OPENED')
    .length;
  const awaitingApproval = remediations.filter(
    (r) => !r.humanApproved && r.status !== 'PR_OPENED' && r.status !== 'CANCELLED' && r.status !== 'FAILED'
  ).length;

  if (loading && remediations.length === 0) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground font-mono">
        Loading Autonomous Safe Fix Agent records...
      </div>
    );
  }

  return (
    <Stack spacing={24}>
      {/* Header */}
      <PageHeader
        title="Autonomous Safe Fix Agent"
        description="Ground-truth code diagnosis, isolated scratch sandboxes, deterministic verification, and automated GitHub PRs."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="inline-flex items-center gap-1.5 font-mono text-3xs"
            >
              <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>{showSettings ? 'Hide Safety Policy' : 'Safety Policy'}</span>
            </Button>
            <Link href={`/projects/${projectId}/cicd`}>
              <Button variant="outline" size="sm" className="font-mono text-3xs">
                CI/CD Gates
              </Button>
            </Link>
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm" className="font-mono text-3xs">
                Back to Project
              </Button>
            </Link>
          </div>
        }
      />

      {/* Safety Policy Editor (Collapsible) */}
      {showSettings && (
        <Card className="border border-cyan-800/40 bg-zinc-950">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Fix Agent Invariants & Safety Ceilings
              </CardTitle>
            </div>
            <CardDescription className="text-3xs text-muted-foreground">
              Configure conservative execution limits. Default branch is strictly read-only. Auto-merge is permanently disabled.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSavePolicy} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agent Enablement */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 text-3xs">Enable Fix Agent</span>
                    <input
                      type="checkbox"
                      checked={agentEnabled}
                      onChange={(e) => setAgentEnabled(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-4xs text-zinc-400 font-sans">
                    When disabled, only PLAN_ONLY queries are accepted. Apply & PR creation are blocked.
                  </p>
                </div>

                {/* Mode Selector */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 text-3xs">Maximum Execution Mode</span>
                    <select
                      value={agentMode}
                      onChange={(e) => setAgentMode(e.target.value as FixAgentMode)}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-3xs text-zinc-200"
                    >
                      <option value="PLAN_ONLY">PLAN_ONLY</option>
                      <option value="DRY_RUN">DRY_RUN</option>
                      <option value="APPLY_AND_VERIFY">APPLY_AND_VERIFY</option>
                      <option value="CREATE_PR">CREATE_PR</option>
                    </select>
                  </div>
                  <p className="text-4xs text-zinc-400 font-sans">
                    Enforces the maximum allowable level of code modification and git operations.
                  </p>
                </div>

                {/* Max Files */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 text-3xs">Max Files Changed (Hard Ceiling: 10)</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxFiles}
                      onChange={(e) => setMaxFiles(Number(e.target.value))}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-3xs text-zinc-200"
                    />
                  </div>
                  <p className="text-4xs text-zinc-400 font-sans">
                    Remediations attempting to alter more files are rejected before sandbox creation.
                  </p>
                </div>

                {/* Max Diff Lines */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 text-3xs">Max Diff Lines (Hard Ceiling: 500)</span>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      value={maxDiffLines}
                      onChange={(e) => setMaxDiffLines(Number(e.target.value))}
                      className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-3xs text-zinc-200"
                    />
                  </div>
                  <p className="text-4xs text-zinc-400 font-sans">
                    Total additions + deletions ceiling across all modified files.
                  </p>
                </div>

                {/* Human Approval Gate */}
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200 text-3xs">Mandatory Human Approval Gate</span>
                    <input
                      type="checkbox"
                      checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                  <p className="text-4xs text-zinc-400 font-sans">
                    Requires a human developer to click &quot;Approve&quot; after diff review before any PR is opened.
                  </p>
                </div>
              </div>

              {policyError && (
                <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800/40 text-rose-300 text-3xs">
                  {policyError}
                </div>
              )}

              {policySuccess && (
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-3xs">
                  {policySuccess}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="submit"
                  variant="accent"
                  size="sm"
                  disabled={savingPolicy}
                  className="font-mono text-3xs"
                >
                  {savingPolicy ? 'Saving...' : 'Save Safety Policy'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 space-y-1">
          <span className="text-3xs text-muted-foreground uppercase tracking-wider">Total Remediations</span>
          <div className="text-2xl font-bold text-zinc-100">{totalRemediations}</div>
          <span className="text-4xs text-zinc-500">Autonomous runs</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 space-y-1">
          <span className="text-3xs text-emerald-400/80 uppercase tracking-wider">Targeted Verifications</span>
          <div className="text-2xl font-bold text-emerald-400">{passedVerifications}</div>
          <span className="text-4xs text-zinc-500">
            {totalRemediations > 0 ? `${Math.round((passedVerifications / totalRemediations) * 100)}% pass rate` : 'No runs yet'}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 space-y-1">
          <span className="text-3xs text-purple-400/80 uppercase tracking-wider">PRs Opened</span>
          <div className="text-2xl font-bold text-purple-300">{prsOpened}</div>
          <span className="text-4xs text-zinc-500">Isolated branches only</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 space-y-1">
          <span className="text-3xs text-amber-400/80 uppercase tracking-wider">Awaiting Review</span>
          <div className="text-2xl font-bold text-amber-300">{awaitingApproval}</div>
          <span className="text-4xs text-zinc-500">Human gate pending</span>
        </div>
      </div>

      {/* Main Content: Split List and Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Remediation History List (Left Column) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-zinc-200 text-xs">Remediation History</h3>
            <span className="text-3xs font-mono text-zinc-500">
              {remediations.length} records
            </span>
          </div>

          {remediations.length === 0 ? (
            <div className="p-8 rounded-xl border border-white/5 bg-zinc-900/20 text-center space-y-2">
              <Wrench className="w-6 h-6 text-zinc-600 mx-auto" />
              <p className="text-zinc-300 text-xs font-medium">No remediations recorded yet.</p>
              <p className="text-3xs text-muted-foreground max-w-xs mx-auto">
                Trigger code remediations directly from diagnosed issues in QA Campaigns or Issue details.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {remediations.map((r) => {
                const isSelected = selectedRemediation?.id === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRemediation(r)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 font-mono text-3xs ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-950/20'
                        : 'border-white/5 bg-zinc-900/40 hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-zinc-200">{r.id}</span>
                        <span className="text-4xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {r.mode}
                        </span>
                      </div>
                      <span
                        className={`text-4xs px-2 py-0.5 rounded uppercase font-semibold ${
                          r.status === 'PR_OPENED' || r.status === 'COMPLETED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/40'
                            : r.status === 'FAILED' || r.status === 'ROLLED_BACK'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800/40'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-800/40 animate-pulse'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-4xs text-muted-foreground">
                      <span>Issue: {r.issueId}</span>
                      <span>
                        Diff: +{r.linesAdded} / -{r.linesRemoved}
                      </span>
                      <span>{new Date(r.createdAt).toLocaleTimeString()}</span>
                    </div>

                    {r.branchName && (
                      <div className="text-4xs text-cyan-400/90 truncate">
                        {r.branchName}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Remediation Detail / Panel (Right Column) */}
        <div className="lg:col-span-7">
          {selectedRemediation ? (
            <FixAgentPanel
              remediation={selectedRemediation}
              projectId={projectId}
              issueId={selectedRemediation.issueId}
              remediationAnalysisId={selectedRemediation.remediationAnalysisId}
              projectPolicy={policy}
              onRefresh={loadData}
            />
          ) : (
            <div className="p-8 rounded-xl border border-white/5 bg-zinc-900/20 text-center text-xs text-muted-foreground">
              Select a remediation run to inspect diffs, test logs, and PR status.
            </div>
          )}
        </div>
      </div>
    </Stack>
  );
}
