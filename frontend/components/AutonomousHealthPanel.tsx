'use client';

// ==============================================================================
// Sculra Autonomous Health & Metrics Panel (frontend/components/AutonomousHealthPanel.tsx)
// ==============================================================================

import React from 'react';
import { AutonomousHealthMetrics } from '@/lib/demoData';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ShieldAlert,
  Cpu,
  RefreshCw,
} from 'lucide-react';

interface AutonomousHealthPanelProps {
  metrics: AutonomousHealthMetrics;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function AutonomousHealthPanel({
  metrics,
  onRefresh,
  isRefreshing = false,
  className = '',
}: AutonomousHealthPanelProps) {
  const formatDuration = (ms: number) => {
    if (!ms || ms <= 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  return (
    <div
      className={`rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              metrics.healthy
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
            }`}
          />
          <h3 className="text-sm font-semibold text-zinc-200">
            Autonomous System Telemetry
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
              metrics.healthy
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {metrics.healthy ? 'System Operational' : 'Degraded (High Failures)'}
          </span>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Refresh telemetry"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Active Campaigns */}
        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Active Campaigns</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {metrics.activeCampaignsCount}
          </div>
        </div>

        {/* Queued / Running Tasks */}
        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>Active Tasks</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            {metrics.runningTasksCount}{' '}
            <span className="text-xs font-normal text-zinc-500">
              ({metrics.queuedTasksCount} queued)
            </span>
          </div>
        </div>

        {/* Completed 24h */}
        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Passed (24h)</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {metrics.completedTasksLast24h}
          </div>
        </div>

        {/* Failed / Skipped 24h */}
        <div className="p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Failed / Skipped</span>
          </div>
          <div className="text-xl font-bold font-mono text-zinc-100">
            <span className="text-rose-400">{metrics.failedTasksLast24h}</span>
            <span className="text-xs font-normal text-zinc-500 ml-1">
              / {metrics.skippedTasksLast24h} skip
            </span>
          </div>
        </div>
      </div>

      {/* Footer Secondary Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/60 text-xs text-zinc-400">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-zinc-500">Avg Task Duration: </span>
            <span className="font-mono text-zinc-300">
              {formatDuration(metrics.avgTaskDurationMs)}
            </span>
          </div>
          <div>
            <span className="text-zinc-500">Pending Approvals: </span>
            <span
              className={`font-mono font-semibold ${
                metrics.pendingApprovalsCount > 0
                  ? 'text-amber-400'
                  : 'text-zinc-300'
              }`}
            >
              {metrics.pendingApprovalsCount}
            </span>
          </div>
        </div>

        {metrics.lastEventTimestamp && (
          <div className="text-zinc-500 font-mono text-[11px]">
            Last event: {new Date(metrics.lastEventTimestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
