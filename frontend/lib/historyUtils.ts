// ==============================================================================
// Sculra Cross-Run QA Intelligence & Historical Memory UI Helpers
// (frontend/lib/historyUtils.ts)
// ==============================================================================

export function formatScoreDelta(delta?: number | null): string {
  if (typeof delta !== 'number' || isNaN(delta)) {
    return '--';
  }
  if (delta > 0) return `+${Math.round(delta)} pts`;
  if (delta < 0) return `${Math.round(delta)} pts`;
  return '0 pts';
}

export function getScoreDeltaColor(delta?: number | null): string {
  if (typeof delta !== 'number' || isNaN(delta)) {
    return 'text-muted-foreground';
  }
  if (delta > 0) return 'text-emerald-400';
  if (delta < 0) return 'text-rose-400';
  return 'text-slate-400';
}

export function getTrendBadge(trend?: string | null): {
  bg: string;
  text: string;
  border: string;
  label: string;
  iconName: 'trending-up' | 'trending-down' | 'minus' | 'alert-triangle' | 'help-circle';
} {
  const t = (trend || '').toUpperCase();
  switch (t) {
    case 'IMPROVING':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        label: 'Improving',
        iconName: 'trending-up',
      };
    case 'DEGRADING':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        label: 'Degrading',
        iconName: 'trending-down',
      };
    case 'STABLE':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'Stable',
        iconName: 'minus',
      };
    case 'VOLATILE':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'Volatile (Flaky)',
        iconName: 'alert-triangle',
      };
    case 'INSUFFICIENT_DATA':
    default:
      return {
        bg: 'bg-zinc-800/40',
        text: 'text-zinc-400',
        border: 'border-zinc-700/40',
        label: 'Initial Baseline',
        iconName: 'help-circle',
      };
  }
}

export function getFindingHistoricalBadge(status?: string | null): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'NEW_REGRESSION':
    case 'REGRESSION':
      return {
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        label: 'NEW REGRESSION',
      };
    case 'RECOVERED':
    case 'RECOVERED_DEFECT':
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        label: 'RECOVERED',
      };
    case 'RECURRING':
    case 'RECURRING_DEFECT':
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'RECURRING',
      };
    case 'NOT_RETESTED':
      return {
        bg: 'bg-slate-700/30',
        text: 'text-slate-400',
        border: 'border-slate-600/30',
        label: 'UN-RETESTED',
      };
    case 'INTERMITTENT':
      return {
        bg: 'bg-purple-500/15',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        label: 'FLAKY / INTERMITTENT',
      };
    default:
      return {
        bg: 'bg-zinc-800',
        text: 'text-zinc-300',
        border: 'border-zinc-700',
        label: s || 'CURRENT',
      };
  }
}

export function getStabilityBadge(stability?: string | null): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  const s = (stability || '').toUpperCase();
  switch (s) {
    case 'STABLE_PASS':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        label: 'Stable Pass',
      };
    case 'STABLE_FAILURE':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        label: 'Persistent Failure',
      };
    case 'INTERMITTENT':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/30',
        label: 'Intermittent / Flaky',
      };
    case 'RECOVERED':
      return {
        bg: 'bg-teal-500/10',
        text: 'text-teal-400',
        border: 'border-teal-500/30',
        label: 'Recovered Target',
      };
    case 'RECURRING':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'Recurring Target',
      };
    case 'INSUFFICIENT_HISTORY':
    default:
      return {
        bg: 'bg-zinc-800/40',
        text: 'text-zinc-400',
        border: 'border-zinc-700/40',
        label: 'Single Run',
      };
  }
}
