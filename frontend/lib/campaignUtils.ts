// ==============================================================================
// Sculra QA Campaign UI Helper Functions & Badges (frontend/lib/campaignUtils.ts)
// ==============================================================================

import { CampaignObjective, CampaignStatus, CampaignStage, CampaignTaskStatus, CampaignDomain } from './demoData';

export function getObjectiveLabel(objective: CampaignObjective): string {
  switch (objective) {
    case 'FULL_REGRESSION':
      return 'Full Regression';
    case 'SMOKE':
      return 'Smoke Test';
    case 'RELEASE_GATE':
      return 'Release Gate';
    case 'SECURITY_SWEEP':
      return 'Security Sweep';
    case 'PERFORMANCE_AUDIT':
      return 'Performance Audit';
    case 'ACCESSIBILITY_AUDIT':
      return 'Accessibility Audit';
    case 'TARGETED_RETEST':
      return 'Targeted Retest';
    case 'EXPLORATORY':
      return 'Exploratory QA';
    default:
      return objective;
  }
}

export function getStageLabel(stage: CampaignStage): string {
  switch (stage) {
    case 'DISCOVERY_MAPPING':
      return '1. Discovery & Mapping';
    case 'SURFACE_VERIFICATION':
      return '2. Surface Verification';
    case 'DEEP_ENGINE_AUDITS':
      return '3. Deep Engine Audits';
    case 'HISTORICAL_CORRELATION':
      return '4. Historical Correlation';
    case 'RELEASE_EVALUATION':
      return '5. Release Evaluation';
    default:
      return stage;
  }
}

export function getDomainLabel(domain: CampaignDomain): string {
  switch (domain) {
    case 'discovery':
      return 'Discovery';
    case 'product':
      return 'Product Model';
    case 'strategy':
      return 'Strategy';
    case 'journey':
      return 'User Journeys';
    case 'visual':
      return 'Visual & Responsive';
    case 'auth':
      return 'Auth & Roles';
    case 'api':
      return 'API & Contracts';
    case 'security':
      return 'Security';
    case 'performance':
      return 'Performance';
    case 'accessibility':
      return 'Accessibility';
    case 'historical':
      return 'Historical Memory';
    case 'release':
      return 'Release Readiness';
    default:
      return domain;
  }
}

export function getCampaignStatusBadgeClass(status: CampaignStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'RUNNING':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse';
    case 'FAILED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    case 'CANCELLED':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'TIMED_OUT':
    case 'BUDGET_EXHAUSTED':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'PENDING':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  }
}

export function getTaskStatusBadgeClass(status: CampaignTaskStatus): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'RUNNING':
      return 'bg-sky-500/10 text-sky-400 border-sky-500/30 animate-pulse';
    case 'FAILED':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    case 'READY':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
    case 'SKIPPED':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    case 'CANCELLED':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'PENDING':
    default:
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }
}

export function getVerdictBadgeClass(verdict?: string): string {
  switch (verdict) {
    case 'RELEASE':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'RELEASE_WITH_CAUTION':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    case 'DO_NOT_RELEASE':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
    case 'INSUFFICIENT_EVIDENCE':
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/40';
  }
}

export function formatDuration(ms?: number | null): string {
  if (ms === undefined || ms === null || isNaN(ms)) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function formatScore(score?: number | null): string {
  if (score === undefined || score === null || isNaN(score)) {
    return '--';
  }
  return `${Math.round(score)}/100`;
}
