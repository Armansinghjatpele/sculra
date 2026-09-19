'use client';

// ==============================================================================
// Sculra Skip Reason Badge Component (frontend/components/SkipReasonBadge.tsx)
// ==============================================================================

import React from 'react';
import { SkipReason } from '@/lib/demoData';
import {
  Ban,
  Clock,
  AlertTriangle,
  FileCheck,
  ShieldAlert,
  PauseCircle,
  Copy,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface SkipReasonBadgeProps {
  reason?: SkipReason;
  className?: string;
  showIcon?: boolean;
}

const SKIP_REASON_CONFIG: Record<
  SkipReason,
  { label: string; bg: string; text: string; border: string; icon: React.ElementType; description: string }
> = {
  NO_CHANGES_DETECTED: {
    label: 'No Changes Detected',
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    icon: FileCheck,
    description: 'Target code or dependencies have not changed since last pass.',
  },
  BUDGET_EXHAUSTED: {
    label: 'Budget Exhausted',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Clock,
    description: 'Time or token execution budget limit reached for this run.',
  },
  ENVIRONMENT_UNAVAILABLE: {
    label: 'Environment Unavailable',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    icon: AlertTriangle,
    description: 'Target environment or URL could not be reached.',
  },
  PREREQUISITE_FAILED: {
    label: 'Prerequisite Failed',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    icon: Ban,
    description: 'Dependent task or workflow setup step failed.',
  },
  FLAKY_QUARANTINED: {
    label: 'Flaky Quarantined',
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
    icon: ShieldAlert,
    description: 'Target quarantined after intermittent non-reproducible failures.',
  },
  LOW_RISK_PATH: {
    label: 'Low Risk Path',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    icon: Layers,
    description: 'Path marked as low impact; prioritized lower by strategy engine.',
  },
  RATE_LIMIT_BACKOFF: {
    label: 'Rate Limit Backoff',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    border: 'border-yellow-500/20',
    icon: Clock,
    description: 'Skipped to prevent upstream API or service rate limit exhaustion.',
  },
  UNAUTHORIZED_BRANCH: {
    label: 'Unauthorized Branch',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    icon: Ban,
    description: 'Branch does not match CI or execution policy whitelist.',
  },
  POLICY_VIOLATION: {
    label: 'Policy Violation',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    icon: ShieldAlert,
    description: 'Action violates project security, safety, or scope policy.',
  },
  DUPLICATE_EXECUTION: {
    label: 'Duplicate Execution',
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    icon: Copy,
    description: 'Identical run or task was already completed for this commit.',
  },
  USER_PAUSED: {
    label: 'User Paused',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/20',
    icon: PauseCircle,
    description: 'Manually paused or cancelled by operator.',
  },
};

export function SkipReasonBadge({ reason, className = '', showIcon = true }: SkipReasonBadgeProps) {
  if (!reason) return null;

  const config = SKIP_REASON_CONFIG[reason] || {
    label: reason,
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-400',
    border: 'border-zinc-500/20',
    icon: HelpCircle,
    description: 'Skipped by autonomous scheduler.',
  };

  const Icon = config.icon;

  return (
    <span
      title={config.description}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {showIcon && <Icon className="w-3 h-3 flex-shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
}
