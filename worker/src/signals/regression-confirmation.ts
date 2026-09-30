// ==============================================================================
// Sculra Production Signal Regression Confirmation Engine
// (worker/src/signals/regression-confirmation.ts)
//
// Invariants (Prompt 64):
// - Reuses existing issue fingerprint/deduplication infrastructure
// - Distinguishes MATCHED_EXISTING_ISSUE, POSSIBLE_MATCH, NEW_SIGNAL, INSUFFICIENT_EVIDENCE
// - Prevents duplicate issue generation
// ==============================================================================

import { IssueMatchState, ProductionSignal } from './types';
import {
  normalizeErrorSignatureForFingerprint,
  normalizeUrlForFingerprint,
} from '../issues/fingerprint';

export interface KnownIssueCandidate {
  id: string;
  fingerprint: string;
  title: string;
  url?: string | null;
  route?: string | null;
  selector?: string | null;
  endpoint?: string | null;
  errorSignature?: string | null;
  status?: string | null;
  createdAt?: string;
}

export interface RegressionConfirmationResult {
  state: IssueMatchState;
  matchedIssueId?: string | null;
  confidence: number;
  reasons: string[];
  evidenceDetails: Record<string, any>;
}

export class RegressionConfirmationEngine {
  /**
   * Compares a production signal against known project issues to confirm regression or identify novel defects.
   */
  public static evaluate(
    signal: ProductionSignal,
    knownIssues: KnownIssueCandidate[]
  ): RegressionConfirmationResult {
    const reasons: string[] = [];
    const evidenceDetails: Record<string, any> = {
      signalId: signal.id,
      signalFingerprint: signal.fingerprint,
      signalRoute: signal.affectedRoute,
      signalUrl: signal.affectedUrl,
    };

    if (!signal.title || signal.title.trim().length === 0) {
      return {
        state: 'INSUFFICIENT_EVIDENCE',
        confidence: 0.0,
        reasons: ['Signal contains insufficient diagnostic data or empty title.'],
        evidenceDetails,
      };
    }

    if (!knownIssues || knownIssues.length === 0) {
      return {
        state: 'NEW_SIGNAL',
        confidence: 0.8,
        reasons: ['No existing issues recorded in project; signal represents a new production defect.'],
        evidenceDetails,
      };
    }

    // 1. Direct Fingerprint Match
    const fingerprintMatch = knownIssues.find(
      (iss) => iss.fingerprint && iss.fingerprint === signal.fingerprint
    );
    if (fingerprintMatch) {
      reasons.push(`Exact fingerprint match with issue '${fingerprintMatch.id}'.`);
      evidenceDetails.matchedIssueId = fingerprintMatch.id;
      evidenceDetails.matchedFingerprint = fingerprintMatch.fingerprint;

      return {
        state: 'MATCHED_EXISTING_ISSUE',
        matchedIssueId: fingerprintMatch.id,
        confidence: 1.0,
        reasons,
        evidenceDetails,
      };
    }

    // 2. Structural & Route / Endpoint Match
    const signalNormUrl = signal.affectedUrl ? normalizeUrlForFingerprint(signal.affectedUrl) : null;
    const signalNormRoute = (signal.affectedRoute || '').toLowerCase().trim();
    const signalNormTitle = (signal.title || '').toLowerCase().trim();

    let bestCandidate: KnownIssueCandidate | null = null;
    let highestScore = 0;

    for (const issue of knownIssues) {
      let score = 0;
      const issueNormUrl = issue.url ? normalizeUrlForFingerprint(issue.url) : null;
      const issueNormRoute = (issue.route || issue.endpoint || '').toLowerCase().trim();
      const issueNormTitle = (issue.title || '').toLowerCase().trim();

      // Route or Endpoint match
      if (signalNormRoute && issueNormRoute) {
        if (signalNormRoute === issueNormRoute) {
          score += 50;
        } else if (signalNormRoute.includes(issueNormRoute) || issueNormRoute.includes(signalNormRoute)) {
          score += 35;
        }
      }

      // Normalized URL match
      if (signalNormUrl && issueNormUrl && signalNormUrl === issueNormUrl) {
        score += 30;
      }

      // Title or error signature match
      if (signalNormTitle && issueNormTitle) {
        if (signalNormTitle === issueNormTitle) {
          score += 40;
        } else if (signalNormTitle.includes(issueNormTitle) || issueNormTitle.includes(signalNormTitle)) {
          score += 25;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = issue;
      }
    }

    if (bestCandidate && highestScore >= 70) {
      reasons.push(
        `Strong diagnostic similarity (score ${highestScore}) with issue '${bestCandidate.id}' on route/title match.`
      );
      evidenceDetails.matchedIssueId = bestCandidate.id;
      evidenceDetails.similarityScore = highestScore;

      return {
        state: 'MATCHED_EXISTING_ISSUE',
        matchedIssueId: bestCandidate.id,
        confidence: 0.85,
        reasons,
        evidenceDetails,
      };
    } else if (bestCandidate && highestScore >= 40) {
      reasons.push(
        `Moderate diagnostic correlation (score ${highestScore}) with issue '${bestCandidate.id}'. Requires human verification.`
      );
      evidenceDetails.possibleIssueId = bestCandidate.id;
      evidenceDetails.similarityScore = highestScore;

      return {
        state: 'POSSIBLE_MATCH',
        matchedIssueId: bestCandidate.id,
        confidence: 0.55,
        reasons,
        evidenceDetails,
      };
    }

    // 3. New Signal
    return {
      state: 'NEW_SIGNAL',
      confidence: 0.85,
      reasons: ['No matching issue fingerprints, routes, or error signatures found among existing project issues.'],
      evidenceDetails,
    };
  }
}
