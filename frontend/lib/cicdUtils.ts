// ==============================================================================
// Sculra CI/CD UI Utilities & Formatting Helpers (frontend/lib/cicdUtils.ts)
// ==============================================================================

export function getVerdictBadgeClass(verdict?: string): string {
  switch (verdict?.toUpperCase()) {
    case 'PASS':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'FAIL':
      return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    case 'INSUFFICIENT_EVIDENCE':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'CANCELLED':
      return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    case 'ERROR':
    default:
      return 'bg-red-500/15 text-red-400 border-red-500/30';
  }
}

export function getVerdictLabel(verdict?: string): string {
  switch (verdict?.toUpperCase()) {
    case 'PASS':
      return 'Passed';
    case 'FAIL':
      return 'Failed';
    case 'INSUFFICIENT_EVIDENCE':
      return 'Insufficient Evidence';
    case 'CANCELLED':
      return 'Cancelled';
    case 'ERROR':
      return 'Error';
    default:
      return verdict || 'Unknown';
  }
}

export function getPolicyLabel(policy?: string): string {
  switch (policy) {
    case 'BLOCK_ON_CRITICAL_ISSUE':
      return 'Block on Critical Issues (Default)';
    case 'STRICT':
      return 'Strict (Zero Regressions, High Quality)';
    case 'PERMISSIVE':
      return 'Permissive (Tolerate Minor Deficiencies)';
    case 'BLOCK_ON_REGRESSION':
      return 'Block on Regressions Only';
    default:
      return policy || 'Block on Critical Issues';
  }
}

export function getReasonCodeLabel(code: string): string {
  switch (code) {
    case 'PASS_CRITERIA_MET':
      return 'All gate quality criteria satisfied';
    case 'CRITICAL_SECURITY_ISSUE':
      return 'Critical security vulnerability detected';
    case 'CRITICAL_BLOCKER_DETECTED':
      return 'Critical functionality blocker detected';
    case 'HIGH_SEVERITY_FINDING':
      return 'High-severity finding violates strict policy';
    case 'NEW_REGRESSION_DETECTED':
      return 'New regression discovered against baseline';
    case 'SCORE_BELOW_THRESHOLD':
      return 'Release score fell below required minimum';
    case 'RECOMMENDATION_DO_NOT_RELEASE':
      return 'AI engine recommendation: DO NOT RELEASE';
    case 'RECOMMENDATION_CAUTION_EXCEEDED':
      return 'Release caution violates strict policy';
    case 'INSUFFICIENT_EVIDENCE_COVERAGE':
      return 'Insufficient coverage or test evidence confidence';
    case 'EXECUTION_CANCELLED':
      return 'Execution cancelled before completion';
    case 'EXECUTION_ERROR':
      return 'Execution terminated due to infrastructure error';
    default:
      return code.replace(/_/g, ' ');
  }
}

export function formatCommitSha(sha?: string): string {
  if (!sha) return '—';
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export function formatTimestamp(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}
