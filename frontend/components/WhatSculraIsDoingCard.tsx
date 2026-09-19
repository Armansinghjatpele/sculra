'use client';

// ==============================================================================
// Sculra "What Is Sculra Doing?" Live State Card (frontend/components/WhatSculraIsDoingCard.tsx)
// ==============================================================================

import React from 'react';
import { Campaign, CampaignTask, AutonomousEvent, HumanApprovalRecord } from '@/lib/demoData';
import { Activity, Play, Pause, AlertCircle, Clock, ArrowRight, ShieldAlert, Cpu } from 'lucide-react';
import Link from 'next/link';

interface WhatSculraIsDoingCardProps {
  projectId: string;
  activeCampaign?: Campaign | null;
  activeTask?: CampaignTask | null;
  lastEvent?: AutonomousEvent | null;
  pendingApprovals?: HumanApprovalRecord[];
  className?: string;
}

export function WhatSculraIsDoingCard({
  projectId,
  activeCampaign,
  activeTask,
  lastEvent,
  pendingApprovals = [],
  className = '',
}: WhatSculraIsDoingCardProps) {
  const hasPendingApproval = pendingApprovals.length > 0;
  const isRunning = Boolean(activeCampaign?.status === 'RUNNING' || activeTask?.status === 'RUNNING');
  const isPending = activeCampaign?.status === 'PENDING';

  return (
    <div
      className={`rounded-xl border p-5 transition-all shadow-sm ${
        hasPendingApproval
          ? 'bg-amber-950/20 border-amber-500/30'
          : isRunning
          ? 'bg-blue-950/20 border-blue-500/30'
          : isPending
          ? 'bg-zinc-900/50 border-zinc-700/50'
          : 'bg-zinc-900/40 border-zinc-800'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            {isRunning ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
            ) : hasPendingApproval ? (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-3 w-3 bg-zinc-500"></span>
            )}
          </div>
          <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400">
            Current Autonomous Activity
          </h2>
        </div>

        {isRunning && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Active
          </span>
        )}
        {hasPendingApproval && !isRunning && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-3.5 h-3.5" />
            Approval Required
          </span>
        )}
        {!isRunning && !hasPendingApproval && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            Idle
          </span>
        )}
      </div>

      {hasPendingApproval && (
        <div className="mb-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-200">
                Action Paused: {pendingApprovals.length} pending human approval{pendingApprovals.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Autonomous remediation produced a verified fix awaiting security review before creating pull request.
              </p>
            </div>
          </div>
          <Link
            href={`/projects/${projectId}/autonomous/approvals`}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-500 text-black hover:bg-amber-400 transition-colors flex items-center gap-1 flex-shrink-0"
          >
            Review Fix
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {activeTask && isRunning ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Executing Task:</span>
            <span className="font-mono text-zinc-200 font-medium">{activeTask.taskKey || activeTask.domain}</span>
          </div>
          {activeTask.target?.identifier && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Target:</span>
              <span className="font-mono text-xs text-blue-400 truncate max-w-[280px]">
                {activeTask.target.identifier}
              </span>
            </div>
          )}
          {activeCampaign && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Campaign:</span>
              <span className="text-xs text-zinc-300 font-medium truncate max-w-[240px]">
                {activeCampaign.name || activeCampaign.id}
              </span>
            </div>
          )}
        </div>
      ) : isRunning && activeCampaign ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Active Campaign:</span>
            <span className="font-semibold text-zinc-200">{activeCampaign.name}</span>
          </div>
          <p className="text-xs text-zinc-400">
            Orchestrator is actively evaluating test matrix and dispatching parallel worker tasks.
          </p>
        </div>
      ) : lastEvent ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>Latest system action ({new Date(lastEvent.createdAt).toLocaleTimeString()}):</span>
          </div>
          <p className="text-sm font-medium text-zinc-200 line-clamp-2">
            {lastEvent.headline}
          </p>
          {lastEvent.reason && (
            <p className="text-xs text-zinc-400 italic">
              &quot;{lastEvent.reason}&quot;
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">
          Sculra is currently idle. Next run will initiate upon git push or scheduled campaign trigger.
        </p>
      )}
    </div>
  );
}
