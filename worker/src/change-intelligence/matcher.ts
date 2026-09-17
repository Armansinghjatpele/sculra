// ==============================================================================
// Sculra Change-Aware QA Matcher & Domain Recommender
// (worker/src/change-intelligence/matcher.ts)
// ==============================================================================

import {
  AffectedApi,
  AffectedRoute,
  AffectedWorkflow,
  ChangeClassification,
  RecommendedDomain,
  StrategyBoost,
} from './types';
import { HistoricalAssociation } from './historical-impact';

export interface MatcherInput {
  classifications: ChangeClassification[];
  affectedRoutes: AffectedRoute[];
  affectedApis: AffectedApi[];
  affectedWorkflows: AffectedWorkflow[];
  historicalAssociations: HistoricalAssociation[];
}

/**
 * Recommends which QA domains should execute and produces target strategy boosts.
 */
export function matchChangeToDomainsAndBoosts(input: MatcherInput): {
  recommendedDomains: RecommendedDomain[];
  strategyBoosts: StrategyBoost[];
} {
  const { classifications, affectedRoutes, affectedApis, affectedWorkflows, historicalAssociations } = input;
  const classSet = new Set(classifications);

  const domainScores = new Map<string, { priority: number; reason: string }>();

  const boostDomain = (domain: string, priority: number, reason: string) => {
    const existing = domainScores.get(domain);
    if (!existing || existing.priority < priority) {
      domainScores.set(domain, { priority, reason });
    }
  };

  // 1. UI changes -> Visual, Responsive, Accessibility, Journeys
  if (classSet.has('UI') || classSet.has('FORM') || classSet.has('NAVIGATION')) {
    boostDomain('VISUAL', 85, 'UI components or visual layout modified');
    boostDomain('ACCESSIBILITY', 80, 'Interactive UI elements or markup modified');
    boostDomain('RESPONSIVE', 75, 'UI layout or styling modified');
    boostDomain('JOURNEY', 80, 'Interactive UI components modified');
  }

  // 2. API changes -> API QA, Functional QA, Security
  if (classSet.has('API') || affectedApis.length > 0) {
    boostDomain('API', 95, 'API route handlers or endpoints modified');
    boostDomain('FUNCTIONAL', 85, 'API backend logic touched');
    boostDomain('SECURITY', 75, 'API endpoint security validation check');
  }

  // 3. Auth changes -> Auth, Security, Critical Workflows
  if (classSet.has('AUTHENTICATION') || classSet.has('AUTHORIZATION')) {
    boostDomain('AUTH', 95, 'Authentication or role authorization boundary modified');
    boostDomain('SECURITY', 90, 'Access control or session handling modified');
    boostDomain('JOURNEY', 85, 'Authenticated user journey verification');
  }

  // 4. Payment changes -> Functional, Journey, API, Security
  if (classSet.has('PAYMENT')) {
    boostDomain('JOURNEY', 95, 'High-priority checkout/payment user journey modified');
    boostDomain('FUNCTIONAL', 90, 'Critical payment flow functionality');
    boostDomain('API', 85, 'Payment gateway or checkout API touched');
    boostDomain('SECURITY', 85, 'Payment data handling and security check');
  }

  // 5. Database changes -> Functional, API
  if (classSet.has('DATABASE')) {
    boostDomain('API', 85, 'Database schema modification impacts API data models');
    boostDomain('FUNCTIONAL', 85, 'Database changes impact data persistence');
  }

  // 6. Performance changes -> Performance
  if (classSet.has('PERFORMANCE')) {
    boostDomain('PERFORMANCE', 90, 'Performance-sensitive caching or async code modified');
  }

  // 7. Historical association domain overrides
  for (const h of historicalAssociations) {
    if (h.recommendedDomain) {
      boostDomain(h.recommendedDomain, 90, `Historically associated defect in ${h.recommendedDomain.toLowerCase()}`);
    }
  }

  const recommendedDomains: RecommendedDomain[] = Array.from(domainScores.entries()).map(
    ([domain, data]) => ({
      domain,
      priority: data.priority,
      reason: data.reason,
    })
  );

  // 8. Generate Specific Target Strategy Boosts
  const strategyBoosts: StrategyBoost[] = [];
  const seenTargets = new Set<string>();

  // Route boosts (CHANGE_DIRECT)
  for (const r of affectedRoutes) {
    if (!seenTargets.has(r.route)) {
      seenTargets.add(r.route);
      strategyBoosts.push({
        targetId: r.route,
        boostType: 'CHANGE_DIRECT',
        priorityBonus: r.confidence === 'HIGH' ? 30 : 20,
        reason: `Priority +${r.confidence === 'HIGH' ? 30 : 20}: Directly mapped to changed route ${r.route}`,
      });
    }
  }

  // API boosts (CHANGE_DIRECT)
  for (const a of affectedApis) {
    if (!seenTargets.has(a.path)) {
      seenTargets.add(a.path);
      strategyBoosts.push({
        targetId: a.path,
        boostType: 'CHANGE_DIRECT',
        priorityBonus: a.confidence === 'HIGH' ? 30 : 20,
        reason: `Priority +${a.confidence === 'HIGH' ? 30 : 20}: Directly mapped to changed API endpoint ${a.path}`,
      });
    }
  }

  // Workflow boosts (CHANGE_BUSINESS_CRITICAL)
  for (const wf of affectedWorkflows) {
    const key = `wf-${wf.workflowId}`;
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      const isCritical = wf.criticality === 'CRITICAL';
      const bonus = isCritical ? 35 : 20;
      strategyBoosts.push({
        targetId: wf.workflowId,
        boostType: 'CHANGE_BUSINESS_CRITICAL',
        priorityBonus: bonus,
        reason: `Priority +${bonus}: Touches business-critical workflow '${wf.workflowName}' (${wf.criticality})`,
      });
    }
  }

  // Historical boosts (CHANGE_HISTORICAL)
  for (const h of historicalAssociations) {
    const key = `hist-${h.targetIdentifier}`;
    if (!seenTargets.has(key)) {
      seenTargets.add(key);
      strategyBoosts.push({
        targetId: h.targetIdentifier,
        boostType: 'CHANGE_HISTORICAL',
        priorityBonus: h.priorityBonus,
        reason: `Priority +${h.priorityBonus}: ${h.reason}`,
      });
    }
  }

  return {
    recommendedDomains,
    strategyBoosts,
  };
}
