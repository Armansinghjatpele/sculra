// ==============================================================================
// Sculra Accessibility UI Formatters & Helpers (frontend/lib/accessibilityUtils.ts)
// ==============================================================================

export function formatAccessibilityScore(score?: number | null): string {
  if (typeof score !== 'number' || isNaN(score)) {
    return '--';
  }
  return `${Math.round(score)}/100`;
}

export function getAccessibilityScoreColor(score?: number | null): string {
  if (typeof score !== 'number' || isNaN(score)) {
    return 'text-muted-foreground';
  }
  if (score >= 85) return 'text-emerald-400';
  if (score >= 70) return 'text-amber-400';
  return 'text-rose-500';
}

export function getAccessibilitySeverityBadge(severity: string = 'medium'): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  const sev = severity.toLowerCase();
  switch (sev) {
    case 'critical':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        label: 'CRITICAL',
      };
    case 'high':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        label: 'HIGH',
      };
    case 'medium':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        label: 'MEDIUM',
      };
    case 'low':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        label: 'LOW',
      };
    default:
      return {
        bg: 'bg-zinc-800',
        text: 'text-zinc-400',
        border: 'border-zinc-700',
        label: sev.toUpperCase(),
      };
  }
}
