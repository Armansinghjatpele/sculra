'use client';

// ==============================================================================
// Sculra Human Approvals & Human-in-the-Loop Panel (frontend/components/HumanApprovalsPanel.tsx)
// ==============================================================================

import React, { useState } from 'react';
import { HumanApprovalRecord } from '@/lib/demoData';
import { DiffViewer } from './DiffViewer';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  GitBranch,
  AlertTriangle,
  FileCode,
  Send,
  Lock,
} from 'lucide-react';

interface HumanApprovalsPanelProps {
  approvals: HumanApprovalRecord[];
  currentHeadSha?: string;
  onDecide: (approvalId: string, decision: 'APPROVED' | 'REJECTED', reason: string) => Promise<void>;
  className?: string;
}

export function HumanApprovalsPanel({
  approvals,
  currentHeadSha,
  onDecide,
  className = '',
}: HumanApprovalsPanelProps) {
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(
    approvals.length > 0 ? approvals[0].id : null
  );
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');
  const historyApprovals = approvals.filter((a) => a.status !== 'PENDING');
  const currentList = activeTab === 'PENDING' ? pendingApprovals : historyApprovals;

  const selectedApproval = approvals.find((a) => a.id === selectedApprovalId) || (currentList[0] ?? null);

  const isExpired = selectedApproval
    ? new Date(selectedApproval.expiresAt).getTime() < Date.now()
    : false;

  const isShaDrifted = selectedApproval && currentHeadSha
    ? selectedApproval.sourceSha !== currentHeadSha
    : false;

  const handleAction = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedApproval) return;
    setIsSubmitting(true);
    try {
      await onDecide(
        selectedApproval.id,
        decision,
        decisionReason.trim() || (decision === 'APPROVED' ? 'Approved by operator' : 'Rejected by operator')
      );
      setDecisionReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              setActiveTab('PENDING');
              if (pendingApprovals.length > 0) setSelectedApprovalId(pendingApprovals[0].id);
            }}
            className={`text-sm font-semibold pb-1.5 transition-colors relative ${
              activeTab === 'PENDING'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pending Approvals ({pendingApprovals.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('HISTORY');
              if (historyApprovals.length > 0) setSelectedApprovalId(historyApprovals[0].id);
            }}
            className={`text-sm font-semibold pb-1.5 transition-colors relative ${
              activeTab === 'HISTORY'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Audit History ({historyApprovals.length})
          </button>
        </div>

        <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Cryptographically Bound (SHA + Plan Version)</span>
        </div>
      </div>

      {currentList.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-zinc-900/30 border border-zinc-800 text-zinc-500 text-sm">
          {activeTab === 'PENDING'
            ? 'No pending approval requests. System is operating within policy boundaries.'
            : 'No prior approval decisions recorded yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Approval Queue List */}
          <div className="space-y-2.5">
            {currentList.map((appr) => {
              const isSelected = selectedApproval?.id === appr.id;
              const expired = new Date(appr.expiresAt).getTime() < Date.now();

              return (
                <button
                  key={appr.id}
                  onClick={() => setSelectedApprovalId(appr.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-950/20 shadow-md ring-1 ring-amber-500'
                      : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs text-zinc-400">
                      {appr.id}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        appr.status === 'PENDING'
                          ? expired
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : appr.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {expired && appr.status === 'PENDING' ? 'EXPIRED' : appr.status}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-zinc-200 line-clamp-1">
                    {appr.issueTitle || `Remediation ${appr.remediationId}`}
                  </p>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>Plan v{appr.fixPlanVersion}</span>
                    <span>{new Date(appr.requestedAt).toLocaleDateString()}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Details & Review Panel */}
          {selectedApproval && (
            <div className="lg:col-span-2 space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {selectedApproval.status}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      Plan v{selectedApproval.fixPlanVersion}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100 mt-1">
                    {selectedApproval.issueTitle || `Remediation ${selectedApproval.remediationId}`}
                  </h3>
                </div>

                <div className="text-right text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-1 text-zinc-400 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Expires:</span>
                  </div>
                  <span
                    className={
                      isExpired ? 'text-red-400 font-semibold' : 'text-zinc-300'
                    }
                  >
                    {new Date(selectedApproval.expiresAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* SHA Drift or Expiry Warnings */}
              {isShaDrifted && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-red-200">
                      Commit Drift Warning
                    </p>
                    <p className="text-red-300/80 mt-0.5">
                      Target repository HEAD has changed since this fix was generated. Approving now will require re-verification against latest HEAD.
                    </p>
                  </div>
                </div>
              )}

              {isExpired && selectedApproval.status === 'PENDING' && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-red-200">
                      Approval Window Expired (24h Limit)
                    </p>
                    <p className="text-red-300/80 mt-0.5">
                      This approval request has exceeded its 24-hour validity window and cannot be approved without regenerating the fix plan.
                    </p>
                  </div>
                </div>
              )}

              {/* Binding Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs font-mono">
                <div>
                  <span className="text-zinc-500">Source SHA: </span>
                  <span className="text-zinc-300 truncate inline-block max-w-[160px]">
                    {selectedApproval.sourceSha.substring(0, 10)}...
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Remediation ID: </span>
                  <span className="text-zinc-300">{selectedApproval.remediationId}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Requested By: </span>
                  <span className="text-zinc-300">{selectedApproval.requestedBy}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Requested At: </span>
                  <span className="text-zinc-300">
                    {new Date(selectedApproval.requestedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Verification & Security Checks */}
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  {selectedApproval.verificationPassed !== false ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-zinc-300">
                    Verification Tests: {selectedApproval.verificationPassed !== false ? 'Passed (0 regressions)' : 'Failed'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {selectedApproval.securityChecksPassed !== false ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span className="text-zinc-300">
                    Security Policy: {selectedApproval.securityChecksPassed !== false ? 'Clean (0 leaks, 0 violations)' : 'Failed'}
                  </span>
                </div>
              </div>

              {/* Patch Diff Viewer */}
              {selectedApproval.patchUnified && (
                <div>
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5">
                    <span className="font-semibold flex items-center gap-1.5">
                      <FileCode className="w-4 h-4 text-blue-400" />
                      Candidate Patch Diff
                    </span>
                    {selectedApproval.diffSummary && (
                      <span className="font-mono text-[11px]">
                        +{selectedApproval.diffSummary.additions} / -{selectedApproval.diffSummary.deletions} ({selectedApproval.diffSummary.filesChanged} file)
                      </span>
                    )}
                  </div>
                  <DiffViewer
                    diff={selectedApproval.patchUnified}
                    maxHeight="260px"
                  />
                </div>
              )}

              {/* Decision Reason Input & Action Buttons */}
              {selectedApproval.status === 'PENDING' && !isExpired && (
                <div className="pt-3 border-t border-zinc-800 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-zinc-300 block mb-1">
                      Operator Decision Rationale (Required for Audit Log):
                    </label>
                    <input
                      type="text"
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                      placeholder="e.g., Code reviewed; guards properly handle null check without regressions"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      onClick={() => handleAction('REJECTED')}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-950/40 text-red-400 border border-red-500/30 hover:bg-red-900/50 transition-colors disabled:opacity-50"
                    >
                      Reject Patch
                    </button>
                    <button
                      onClick={() => handleAction('APPROVED')}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Approve & Open Pull Request
                    </button>
                  </div>
                </div>
              )}

              {/* Already Decided Notice */}
              {selectedApproval.status !== 'PENDING' && (
                <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-400 space-y-1">
                  <p>
                    <strong className="text-zinc-200">Decided: </strong>
                    {selectedApproval.status} by{' '}
                    <span className="font-mono text-zinc-300">
                      {selectedApproval.approvedBy || selectedApproval.rejectedBy || 'System'}
                    </span>
                  </p>
                  {selectedApproval.decisionReason && (
                    <p className="italic">
                      &quot;{selectedApproval.decisionReason}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
