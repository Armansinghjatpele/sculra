'use client';

// ==============================================================================
// Sculra AI Root Cause Diagnosis & Remediation Panel
// (frontend/components/IssueRemediationPanel.tsx)
// ==============================================================================

import * as React from 'react';
import { RemediationAnalysis, RootCauseHypothesis, FixStep } from '@/lib/demoData';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  GitCommit,
  History,
  Lightbulb,
  Wrench,
  CheckSquare,
  HelpCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { FixAgentPanel } from './FixAgentPanel';

export function IssueRemediationPanel({
  remediation,
  loading = false,
  projectId,
  issueId,
}: {
  remediation?: RemediationAnalysis | null;
  loading?: boolean;
  projectId?: string;
  issueId?: string;
}) {
  const [activeTab, setActiveTab] = React.useState<
    'diagnosis' | 'hypotheses' | 'code' | 'changes' | 'fix' | 'verify' | 'remediate'
  >('diagnosis');

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 flex items-center gap-3 animate-pulse">
        <Lightbulb className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-mono text-cyan-300">
          Sculra AI Root Cause Analysis in progress...
        </span>
      </div>
    );
  }

  // Phase 32: UI Honesty states
  if (!remediation || remediation.status === 'NOT_ANALYZED') {
    return (
      <div className="p-3 rounded-lg border border-white/5 bg-zinc-900/30 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-zinc-500" />
          <span>AI Root Cause Diagnosis: <strong>Not analyzed</strong></span>
        </div>
        <span className="text-3xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
          Awaiting Campaign Analysis
        </span>
      </div>
    );
  }

  if (remediation.status === 'FAILED') {
    return (
      <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-950/20 text-xs text-rose-300 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
        <span>Analysis unavailable: Encountered error during context aggregation.</span>
      </div>
    );
  }

  if (remediation.status === 'INSUFFICIENT_EVIDENCE') {
    return (
      <div className="p-3 rounded-lg border border-purple-500/20 bg-purple-950/20 text-xs text-purple-300 flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-purple-400" />
        <span>Insufficient evidence: Empirical observations were insufficient to isolate root cause.</span>
      </div>
    );
  }

  const { diagnosis, hypotheses, fixPlan, verificationPlan } = remediation;

  const getConfidenceBadge = (conf: string) => {
    switch (conf) {
      case 'VERY_HIGH':
        return 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50';
      case 'HIGH':
        return 'bg-cyan-950/50 text-cyan-300 border-cyan-800/50';
      case 'MEDIUM':
        return 'bg-amber-950/50 text-amber-300 border-amber-800/50';
      case 'LOW':
        return 'bg-orange-950/50 text-orange-300 border-orange-800/50';
      case 'VERY_LOW':
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DIAGNOSED':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40';
      case 'PARTIAL':
        return 'bg-amber-950/40 text-amber-400 border-amber-800/40';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-zinc-950/90 overflow-hidden shadow-xl shadow-cyan-950/20">
      {/* Header Banner */}
      <div className="p-4 bg-gradient-to-r from-cyan-950/40 via-zinc-900/60 to-black/40 border-b border-border/40 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Lightbulb className="w-5 h-5 text-cyan-400" />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground tracking-tight">
                AI Root Cause Diagnosis & Fix Plan
              </h4>
              <span className={`text-4xs uppercase font-mono px-2 py-0.5 rounded-full border ${getStatusBadge(remediation.status)}`}>
                {remediation.status === 'PARTIAL' ? 'Partial Analysis' : 'Diagnosed'}
              </span>
              <span className={`text-4xs uppercase font-mono px-2 py-0.5 rounded-full border ${getConfidenceBadge(remediation.confidence)}`}>
                {remediation.confidence.replace(/_/g, ' ')} Confidence
              </span>
            </div>
            <p className="text-3xs text-muted-foreground mt-0.5">
              Strictly grounded empirical diagnosis. Never treats inference as observed fact.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-lg border border-white/5 text-2xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('diagnosis')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'diagnosis' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Diagnosis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hypotheses')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'hypotheses' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Hypotheses ({hypotheses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'code' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Code Context
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('changes')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'changes' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Changes & History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fix')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'fix' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Fix Plan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verify')}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === 'verify' ? 'bg-cyan-500/20 text-cyan-300 font-semibold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Verification
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('remediate')}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
              activeTab === 'remediate' ? 'bg-purple-900/40 text-purple-300 font-semibold border border-purple-700/50' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span>Fix Agent</span>
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="p-4 text-xs space-y-4">
        {/* Tab 1: Diagnosis */}
        {activeTab === 'diagnosis' && (
          <div className="space-y-3">
            <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs uppercase font-mono text-cyan-400 font-semibold tracking-wider">
                  Likely Root Cause
                </span>
                <span className="text-4xs font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                  Category: {diagnosis.category}
                </span>
              </div>
              <p className="text-sm font-semibold text-zinc-100">
                {diagnosis.summary}
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {diagnosis.explanation}
              </p>
            </div>

            {/* Direct runtime locations */}
            {diagnosis.directLocations.length > 0 && (
              <div>
                <span className="text-3xs uppercase font-mono text-zinc-400 block mb-1 font-semibold">
                  Direct Runtime Locations
                </span>
                <div className="space-y-1.5">
                  {diagnosis.directLocations.map((loc, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-zinc-900/40 border border-white/5 font-mono text-3xs flex items-center justify-between text-zinc-300"
                    >
                      <span className="truncate">
                        📁 {loc.filePath}{loc.line ? `:${loc.line}` : ''}
                      </span>
                      {loc.functionName && (
                        <span className="text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/30 shrink-0 ml-2">
                          fn: {loc.functionName}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Limitations disclaimer */}
            {diagnosis.limitations && diagnosis.limitations.length > 0 && (
              <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/30 text-3xs text-amber-300/90 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Analysis Boundary Notes:</span>
                  {diagnosis.limitations.map((lim, idx) => (
                    <span key={idx} className="block">• {lim}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Hypotheses */}
        {activeTab === 'hypotheses' && (
          <div className="space-y-2.5">
            {hypotheses.map((h) => {
              const isSupported = h.status === 'SUPPORTED';
              const isRejected = h.status === 'REJECTED';

              return (
                <div
                  key={h.id}
                  className={`p-3 rounded-lg border ${
                    isSupported
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : isRejected
                      ? 'border-rose-500/20 bg-rose-950/10 opacity-75'
                      : 'border-white/5 bg-zinc-900/40'
                  } space-y-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xs font-mono font-semibold text-zinc-400 uppercase">
                      Hypothesis: {h.category}
                    </span>
                    <span
                      className={`text-4xs uppercase font-mono px-2 py-0.5 rounded border ${
                        isSupported
                          ? 'text-emerald-400 border-emerald-800/40 bg-emerald-950/30'
                          : isRejected
                          ? 'text-rose-400 border-rose-800/40 bg-rose-950/30'
                          : 'text-amber-400 border-amber-800/40 bg-amber-950/30'
                      }`}
                    >
                      {h.status}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-200 font-medium">
                    {h.statement}
                  </p>

                  {h.rejectionReason && (
                    <p className="text-3xs text-rose-300 font-mono">
                      ❌ Rejected: {h.rejectionReason}
                    </p>
                  )}

                  {h.filePaths.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-4xs text-muted-foreground font-mono">Grounded in:</span>
                      {h.filePaths.map((f, idx) => (
                        <span key={idx} className="text-4xs font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Code Context */}
        {activeTab === 'code' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-3xs text-muted-foreground font-mono">
              <span>
                Retrieved Files ({remediation.codeContextSummary?.filesRetrieved || 0}) • Symbols ({remediation.codeContextSummary?.symbolsIdentified || 0})
              </span>
              {remediation.codeContextSummary?.isPartial && (
                <span className="text-amber-400">⚠️ Bounded Context</span>
              )}
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/50 border border-white/5 font-mono text-3xs text-zinc-300 space-y-1">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold mb-2">
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Code Context Evidence Bound</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Code context was statically retrieved in read-only mode via source maps, stack traces, and Next.js route mapping. No repository binaries or scripts were executed.
              </p>
            </div>
          </div>
        )}

        {/* Tab 4: Changes & History */}
        {activeTab === 'changes' && (
          <div className="space-y-3">
            {/* Change Context */}
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs uppercase font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5" />
                  Prompt 32 Change Context
                </span>
                <span className="text-4xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {remediation.changeContextSummary?.relationship || 'NO_KNOWN_CHANGE_RELATIONSHIP'}
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Commit: <code className="text-cyan-300">{remediation.changeContextSummary?.commitSha?.substring(0, 8) || 'N/A'}</code>
              </p>
            </div>

            {/* Historical QA Context */}
            <div className="p-3 rounded-lg bg-zinc-900/50 border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-3xs uppercase font-mono text-purple-400 font-semibold flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Prompt 28 Historical QA Memory
                </span>
                <span className="text-4xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                  {remediation.historicalContextSummary?.isRecurring ? 'RECURRING' : 'CURRENT_FAILURE'}
                </span>
              </div>
              <p className="text-xs text-zinc-300">
                Total observed occurrences across compatible runs: <strong>{remediation.historicalContextSummary?.totalOccurrences || 1}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Tab 5: Fix Plan */}
        {activeTab === 'fix' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                {fixPlan.summary}
              </h5>
              <span
                className={`text-4xs font-mono uppercase px-2 py-0.5 rounded border ${
                  fixPlan.riskAssessment === 'SECURITY_RISK'
                    ? 'text-rose-400 bg-rose-950/40 border-rose-800'
                    : 'text-emerald-400 bg-emerald-950/40 border-emerald-800'
                }`}
              >
                Risk: {fixPlan.riskAssessment}
              </span>
            </div>

            {fixPlan.securityHazards && (
              <div className="p-2.5 rounded bg-rose-950/30 border border-rose-800/40 text-rose-300 text-3xs">
                🚨 Security Risk: {fixPlan.securityHazards.join(' ')}
              </div>
            )}

            <div className="space-y-2">
              {fixPlan.steps.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-zinc-900/50 border border-white/5 space-y-1 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-4xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      Step {s.stepNumber}
                    </span>
                    <span className="font-mono text-cyan-400 text-3xs uppercase font-semibold">
                      {s.action}
                    </span>
                    {s.targetFile && (
                      <span className="text-4xs font-mono text-zinc-400 truncate">
                        {s.targetFile}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-200 text-3xs pl-6 leading-relaxed">
                    {s.description}
                  </p>
                  {s.rationale && (
                    <p className="text-4xs text-muted-foreground pl-6 font-sans">
                      Rationale: {s.rationale}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 flex items-center justify-between gap-3 font-mono text-3xs">
              <div className="flex items-center gap-2 text-cyan-300">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Autonomous Safe Fix Agent is ready to generate and test code for this issue.</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('remediate')}
                className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors cursor-pointer text-4xs shrink-0"
              >
                Launch Fix Agent →
              </button>
            </div>
          </div>
        )}

        {/* Tab 6: Verification */}
        {activeTab === 'verify' && (
          <div className="space-y-3">
            <div>
              <span className="text-3xs uppercase font-mono text-cyan-400 font-semibold block mb-1">
                Recommended QA Verification Domains
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {verificationPlan.suggestedDomains.map((dom, idx) => (
                  <span
                    key={idx}
                    className="text-3xs font-mono px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-800/30 uppercase"
                  >
                    {dom}
                  </span>
                ))}
              </div>
            </div>

            {verificationPlan.regressionTests && verificationPlan.regressionTests.length > 0 && (
              <div>
                <span className="text-3xs uppercase font-mono text-zinc-400 font-semibold block mb-1">
                  Deterministic Regression Test Suggestions
                </span>
                <div className="space-y-1.5">
                  {verificationPlan.regressionTests.map((t, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-zinc-900/40 border border-white/5 text-3xs text-zinc-300 flex items-start gap-2"
                    >
                      <CheckSquare className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Safe Fix Agent */}
        {activeTab === 'remediate' && (
          <FixAgentPanel
            projectId={projectId || remediation.projectId}
            issueId={issueId || remediation.issueId}
            remediationAnalysisId={remediation.id}
          />
        )}
      </div>
    </div>
  );
}
