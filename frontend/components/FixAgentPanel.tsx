'use client';

// ==============================================================================
// Sculra Autonomous Safe Fix Agent Interactive Remediation Panel
// (frontend/components/FixAgentPanel.tsx)
// ==============================================================================

import * as React from 'react';
import {
  FixRemediation,
  FixEvidence,
  ProjectFixPolicy,
  FixAgentMode,
  FixAgentState,
} from '@/lib/demoData';
import { DiffViewer } from './DiffViewer';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  GitPullRequest,
  GitBranch,
  Terminal,
  Play,
  RotateCcw,
  Check,
  X,
  ExternalLink,
  Loader2,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface FixAgentPanelProps {
  remediation?: FixRemediation | null;
  evidence?: FixEvidence[];
  projectId: string;
  issueId: string;
  remediationAnalysisId?: string;
  projectPolicy?: ProjectFixPolicy | null;
  onRefresh?: () => void;
  onRemediationCreated?: (rem: FixRemediation) => void;
}

function getStatusBadge(status: FixAgentState) {
  switch (status) {
    case 'COMPLETED':
    case 'PR_OPENED':
      return { label: status, class: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50' };
    case 'FAILED':
    case 'ROLLED_BACK':
      return { label: status, class: 'bg-rose-950/60 text-rose-300 border-rose-700/50' };
    case 'CANCELLED':
      return { label: 'CANCELLED', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
    case 'INITIAL':
    case 'AUTHORIZED':
    case 'PLAN_VALIDATED':
    case 'CONTEXT_RETRIEVED':
    case 'PATCH_GENERATED':
    case 'WORKSPACE_INITIALIZED':
    case 'BASELINE_RUN':
    case 'PATCH_APPLIED':
    case 'TESTS_RUN':
    case 'DIFF_REVIEWED':
    case 'BRANCH_COMMITTED':
    case 'BRANCH_PUSHED':
      return { label: status.replace(/_/g, ' '), class: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50 animate-pulse' };
    default:
      return { label: status, class: 'bg-zinc-800 text-zinc-400 border-zinc-700' };
  }
}

function getModeBadge(mode: FixAgentMode) {
  switch (mode) {
    case 'CREATE_PR':
      return 'bg-purple-950/60 text-purple-300 border-purple-800/40';
    case 'APPLY_AND_VERIFY':
      return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40';
    case 'DRY_RUN':
      return 'bg-amber-950/60 text-amber-300 border-amber-800/40';
    case 'PLAN_ONLY':
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700';
  }
}

export function FixAgentPanel({
  remediation: initialRemediation,
  evidence: initialEvidence = [],
  projectId,
  issueId,
  remediationAnalysisId,
  projectPolicy,
  onRefresh,
  onRemediationCreated,
}: FixAgentPanelProps) {
  const [remediation, setRemediation] = React.useState<FixRemediation | null>(
    initialRemediation || null
  );
  const [evidence, setEvidence] = React.useState<FixEvidence[]>(initialEvidence);
  const [activeTab, setActiveTab] = React.useState<
    'diff' | 'verification' | 'review' | 'pr' | 'evidence'
  >('diff');
  const [selectedMode, setSelectedMode] = React.useState<FixAgentMode>('PLAN_ONLY');
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRemediation(initialRemediation || null);
  }, [initialRemediation]);

  React.useEffect(() => {
    setEvidence(initialEvidence);
  }, [initialEvidence]);

  const isRunning =
    remediation &&
    ![
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'ROLLED_BACK',
      'PR_OPENED',
    ].includes(remediation.status);

  // Poll remediation status if it is in an intermediate running state
  React.useEffect(() => {
    if (!isRunning || !remediation?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/fixes/${remediation.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.remediation) {
            setRemediation(data.remediation);
            if (data.evidence) setEvidence(data.evidence);
            if (
              ['COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK', 'PR_OPENED'].includes(
                data.remediation.status
              )
            ) {
              onRefresh?.();
            }
          }
        }
      } catch (e) {
        console.error('Error polling fix remediation:', e);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isRunning, remediation?.id, onRefresh]);

  const handleLaunchFix = async (modeToUse: FixAgentMode) => {
    try {
      setIsExecuting(true);
      setActionError(null);
      setActionSuccess(null);

      const res = await fetch(`/api/projects/${projectId}/fixes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId,
          remediationAnalysisId,
          mode: modeToUse,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start fix remediation');
      }

      setRemediation(data.remediation);
      setActionSuccess(`Remediation started in ${modeToUse} mode.`);
      onRemediationCreated?.(data.remediation);
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelFix = async () => {
    if (!remediation?.id) return;
    try {
      setIsExecuting(true);
      setActionError(null);
      const res = await fetch(`/api/fixes/${remediation.id}/cancel`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to cancel remediation');
      }
      setRemediation(data.remediation);
      setActionSuccess('Remediation cancelled.');
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Cancel failed');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleApprove = async () => {
    if (!remediation?.id) return;
    try {
      setIsExecuting(true);
      setActionError(null);
      const res = await fetch(`/api/fixes/${remediation.id}/create-pr`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve and create PR');
      }
      setRemediation(data.remediation);
      setActionSuccess('Fix approved and PR created successfully!');
      onRefresh?.();
    } catch (err: any) {
      setActionError(err.message || 'Approval failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-4 space-y-4 font-sans text-xs">
      {/* Panel Top Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/60 border border-cyan-800/40">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="font-semibold text-zinc-100 flex items-center gap-2">
              Autonomous Safe Fix Agent
              {remediation && (
                <span
                  className={`text-3xs font-mono px-2 py-0.5 rounded border uppercase ${
                    getStatusBadge(remediation.status).class
                  }`}
                >
                  {getStatusBadge(remediation.status).label}
                </span>
              )}
            </h4>
            <p className="text-3xs text-muted-foreground">
              Isolated workspace sandbox, targeted baseline/post-fix verification, diff review, and safe PR creation.
            </p>
          </div>
        </div>

        {remediation && (
          <div className="flex items-center gap-2">
            <span
              className={`text-3xs font-mono px-2 py-0.5 rounded border uppercase ${getModeBadge(
                remediation.mode
              )}`}
            >
              Mode: {remediation.mode}
            </span>
            {remediation.executionTimeMs > 0 && (
              <span className="text-3xs font-mono text-zinc-400 flex items-center gap-1 bg-zinc-900 px-2 py-0.5 rounded border border-white/5">
                <Clock className="w-3 h-3 text-zinc-500" />
                {(remediation.executionTimeMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-300 text-3xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-3xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* When no remediation is running or launched */}
      {!remediation ? (
        <div className="p-4 rounded-xl border border-white/5 bg-zinc-900/30 space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-zinc-200 text-xs font-medium">
                No active code remediation for this diagnosed issue.
              </p>
              <p className="text-3xs text-muted-foreground leading-relaxed">
                Sculra will ground this fix against the diagnosed root cause, generate a structured code patch, execute targeted verification in an isolated scratch sandbox, perform an automated diff review, and open an isolated branch PR without modifying the main branch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-white/5 flex-wrap">
            <button
              onClick={() => handleLaunchFix('PLAN_ONLY')}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-3xs font-mono font-medium border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileCode2 className="w-3.5 h-3.5 text-zinc-400" />
              Generate Fix Plan (PLAN_ONLY)
            </button>

            <button
              onClick={() => handleLaunchFix('DRY_RUN')}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 text-amber-300 text-3xs font-mono font-medium border border-amber-800/40 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Terminal className="w-3.5 h-3.5 text-amber-400" />
              Dry Run Sandbox (DRY_RUN)
            </button>

            <button
              onClick={() => handleLaunchFix('APPLY_AND_VERIFY')}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-3xs font-mono font-medium border border-cyan-800/50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 text-cyan-400" />
              Apply & Verify (APPLY_AND_VERIFY)
            </button>

            <button
              onClick={() => handleLaunchFix('CREATE_PR')}
              disabled={isExecuting}
              className="px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 text-3xs font-mono font-semibold border border-purple-700/50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
              ) : (
                <GitPullRequest className="w-3.5 h-3.5 text-purple-400" />
              )}
              Open Fix Pull Request (CREATE_PR)
            </button>
          </div>
        </div>
      ) : (
        /* Active or Completed Remediation Detail View */
        <div className="space-y-4">
          {/* Failure Alert Banner */}
          {remediation.status === 'FAILED' && (
            <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-3xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Fix Remediation Halted: {remediation.errorCode || 'EXECUTION_FAILED'}</span>
              </div>
              <p className="pl-6 font-mono text-rose-300/90">{remediation.errorMessage}</p>
            </div>
          )}

          {/* Rollback Alert Banner */}
          {remediation.status === 'ROLLED_BACK' && (
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-3xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-200">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>Remediation Safely Rolled Back</span>
              </div>
              <p className="pl-6 text-amber-300/90">
                Targeted verification failed or policy violation was detected. Scratch sandbox was cleanly cleaned up. Main branch was left untouched.
              </p>
            </div>
          )}

          {/* PR Opened Banner */}
          {remediation.status === 'PR_OPENED' && remediation.pullRequestUrl && (
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-emerald-300 text-3xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-200">
                    Fix Pull Request #{remediation.pullRequestNumber} Opened
                  </span>
                  <span className="block text-4xs font-mono text-emerald-400/80">
                    Branch: {remediation.branchName}
                  </span>
                </div>
              </div>
              <a
                href={remediation.pullRequestUrl}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1 rounded bg-emerald-800/50 hover:bg-emerald-700/60 text-white font-mono text-3xs flex items-center gap-1 transition-colors"
              >
                <span>View on GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex items-center gap-1 border-b border-white/5 pb-2">
            <button
              onClick={() => setActiveTab('diff')}
              className={`px-3 py-1 rounded-md font-mono text-3xs font-medium transition-colors ${
                activeTab === 'diff'
                  ? 'bg-zinc-800 text-cyan-300 border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Unified Diff ({remediation.linesAdded}+ / {remediation.linesRemoved}-)
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`px-3 py-1 rounded-md font-mono text-3xs font-medium transition-colors ${
                activeTab === 'verification'
                  ? 'bg-zinc-800 text-cyan-300 border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Verification Results
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1 rounded-md font-mono text-3xs font-medium transition-colors ${
                activeTab === 'review'
                  ? 'bg-zinc-800 text-cyan-300 border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Diff Review & Safety
            </button>
            <button
              onClick={() => setActiveTab('pr')}
              className={`px-3 py-1 rounded-md font-mono text-3xs font-medium transition-colors ${
                activeTab === 'pr'
                  ? 'bg-zinc-800 text-cyan-300 border border-white/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Git & PR
            </button>
            {evidence.length > 0 && (
              <button
                onClick={() => setActiveTab('evidence')}
                className={`px-3 py-1 rounded-md font-mono text-3xs font-medium transition-colors ${
                  activeTab === 'evidence'
                    ? 'bg-zinc-800 text-cyan-300 border border-white/10'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Audit Evidence ({evidence.length})
              </button>
            )}
          </div>

          {/* Tab 1: Diff */}
          {activeTab === 'diff' && (
            <div className="space-y-2">
              {remediation.patchStructured?.summary && (
                <p className="text-3xs text-zinc-300 bg-zinc-900/40 p-2.5 rounded-lg border border-white/5 font-mono">
                  <strong>Patch Summary:</strong> {remediation.patchStructured.summary}
                </p>
              )}
              <DiffViewer
                diff={remediation.patchUnified}
                structuredPatch={remediation.patchStructured}
                maxHeight="350px"
              />
            </div>
          )}

          {/* Tab 2: Verification */}
          {activeTab === 'verification' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-3xs">
                <div className="p-2 rounded bg-zinc-900/40 border border-white/5">
                  <span className="text-zinc-500 block">Baseline Status</span>
                  <span
                    className={`font-bold ${
                      remediation.baselineStatus === 'FAILED'
                        ? 'text-rose-400'
                        : remediation.baselineStatus === 'PASSED'
                        ? 'text-emerald-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {remediation.baselineStatus} (Reproduction)
                  </span>
                </div>
                <div className="p-2 rounded bg-zinc-900/40 border border-white/5">
                  <span className="text-zinc-500 block">Verification Status</span>
                  <span
                    className={`font-bold ${
                      remediation.verificationStatus === 'PASSED'
                        ? 'text-emerald-400'
                        : remediation.verificationStatus === 'FAILED'
                        ? 'text-rose-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {remediation.verificationStatus}
                  </span>
                </div>
                <div className="p-2 rounded bg-zinc-900/40 border border-white/5">
                  <span className="text-zinc-500 block">Tests Passed</span>
                  <span className="font-bold text-zinc-200">
                    {remediation.verificationResults?.testsPassed ?? '--'} /{' '}
                    {remediation.verificationResults?.testsRun ?? '--'}
                  </span>
                </div>
                <div className="p-2 rounded bg-zinc-900/40 border border-white/5">
                  <span className="text-zinc-500 block">Regressions</span>
                  <span
                    className={`font-bold ${
                      remediation.verificationResults?.regressionDetected
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {remediation.verificationResults?.regressionDetected ? 'DETECTED' : 'NONE'}
                  </span>
                </div>
              </div>

              {/* Command outputs */}
              {remediation.verificationResults?.commandResults && (
                <div className="space-y-2">
                  <span className="font-mono text-4xs uppercase tracking-wider text-zinc-400 font-semibold">
                    Executed Deterministic Commands:
                  </span>
                  {remediation.verificationResults.commandResults.map((cmd, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-white/5 font-mono text-3xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-zinc-400">
                        <span className="text-cyan-400 font-semibold">$ {cmd.command}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-4xs ${
                            cmd.exitCode === 0
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-rose-950 text-rose-300'
                          }`}
                        >
                          exit {cmd.exitCode} ({cmd.durationMs}ms)
                        </span>
                      </div>
                      {cmd.stdout && (
                        <pre className="text-zinc-300 bg-zinc-900/70 p-2 rounded max-h-36 overflow-y-auto whitespace-pre-wrap text-4xs">
                          {cmd.stdout}
                        </pre>
                      )}
                      {cmd.stderr && (
                        <pre className="text-rose-300 bg-rose-950/40 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap text-4xs">
                          {cmd.stderr}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Diff Review */}
          {activeTab === 'review' && (
            <div className="space-y-3 font-mono text-3xs">
              <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-semibold">Automated Diff Review Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-4xs uppercase font-bold ${
                      remediation.diffReviewResults?.passed
                        ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/50'
                        : 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                    }`}
                  >
                    {remediation.diffReviewResults?.passed ? 'PASSED' : 'REJECTED / PENDING'}
                  </span>
                </div>
                {remediation.diffReviewResults?.comments && (
                  <div className="space-y-1 pt-2 border-t border-white/5">
                    {remediation.diffReviewResults.comments.map((c, idx) => (
                      <p key={idx} className="text-zinc-300 flex items-start gap-1.5">
                        <Check className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {remediation.diffReviewResults?.secretLeaksDetected &&
                remediation.diffReviewResults.secretLeaksDetected.length > 0 && (
                  <div className="p-2.5 rounded bg-rose-950/50 border border-rose-800/40 text-rose-300 text-3xs">
                    <span className="font-bold block mb-1">Secret Leaks Detected:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {remediation.diffReviewResults.secretLeaksDetected.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}

          {/* Tab 4: Git & PR */}
          {activeTab === 'pr' && (
            <div className="space-y-3 font-mono text-3xs">
              <div className="p-3 rounded-lg bg-zinc-900/40 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Target Remediation Branch:</span>
                  <span className="text-cyan-300 font-semibold">
                    {remediation.branchName || '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Base Branch (Read-Only):</span>
                  <span className="text-zinc-300">{remediation.baseBranch || 'main'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Commit SHA:</span>
                  <span className="text-zinc-300">
                    {remediation.commitSha ? remediation.commitSha.slice(0, 10) : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Human Approval:</span>
                  <span
                    className={
                      remediation.humanApproved
                        ? 'text-emerald-400 font-bold'
                        : 'text-amber-400 font-bold'
                    }
                  >
                    {remediation.humanApproved ? 'APPROVED' : 'AWAITING_REVIEW'}
                  </span>
                </div>
              </div>

              {/* Action: Human approval button if awaiting */}
              {!remediation.humanApproved && remediation.status !== 'PR_OPENED' && (
                <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-800/30 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-cyan-300 block">
                      Human Review Gate
                    </span>
                    <p className="text-4xs text-zinc-400 font-sans">
                      Verify code diff and test runs before opening a GitHub Pull Request.
                    </p>
                  </div>
                  <button
                    onClick={handleApprove}
                    disabled={isExecuting}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-3xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve & Open PR
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Evidence */}
          {activeTab === 'evidence' && (
            <div className="space-y-2 font-mono text-3xs max-h-72 overflow-y-auto">
              {evidence.map((ev) => (
                <div
                  key={ev.id}
                  className="p-2 rounded bg-zinc-950 border border-white/5 space-y-1"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-4xs">
                    <span className="text-cyan-400 font-bold uppercase">{ev.evidenceType}</span>
                    <span>{new Date(ev.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <pre className="text-zinc-300 text-4xs whitespace-pre-wrap bg-zinc-900/50 p-1.5 rounded">
                    {ev.content}
                  </pre>
                </div>
              ))}
            </div>
          )}

          {/* Action Bar at Bottom */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {isRunning && (
                <button
                  onClick={handleCancelFix}
                  disabled={isExecuting}
                  className="px-3 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-200 text-3xs font-mono font-medium border border-rose-800/50 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5 text-rose-400" />
                  Cancel Remediation
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleLaunchFix('PLAN_ONLY')}
                disabled={isExecuting}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-3xs font-mono border border-white/5 transition-colors cursor-pointer"
              >
                Re-plan
              </button>
              <button
                onClick={() => handleLaunchFix('APPLY_AND_VERIFY')}
                disabled={isExecuting}
                className="px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-3xs font-mono border border-cyan-800/40 transition-colors cursor-pointer"
              >
                Apply & Verify
              </button>
              <button
                onClick={() => handleLaunchFix('CREATE_PR')}
                disabled={isExecuting}
                className="px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 text-3xs font-mono border border-purple-800/40 transition-colors cursor-pointer"
              >
                Create PR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
