// ==============================================================================
// Sculra Cross-Run Finding Matcher (worker/src/history/matcher.ts)
// ==============================================================================

import { HistoricalFinding } from './types';
import { RunNormalizer } from './run-normalizer';

export interface FindingMatchResult {
  matchedPairs: Array<{ current: HistoricalFinding; previous: HistoricalFinding; matchType: 'FINGERPRINT' | 'SIGNATURE' }>;
  unmatchedCurrent: HistoricalFinding[]; // Present in current, absent in previous
  unmatchedPrevious: HistoricalFinding[]; // Present in previous, absent in current
}

export class FindingMatcher {
  /**
   * Matches current findings against previous comparable findings deterministically.
   */
  static matchFindings(
    currentFindings: HistoricalFinding[],
    previousFindings: HistoricalFinding[]
  ): FindingMatchResult {
    const matchedPairs: Array<{
      current: HistoricalFinding;
      previous: HistoricalFinding;
      matchType: 'FINGERPRINT' | 'SIGNATURE';
    }> = [];

    const matchedPreviousIndices = new Set<number>();
    const matchedCurrentIndices = new Set<number>();

    // 1. Primary Match: Exact SHA-256 Fingerprint
    for (let cIdx = 0; cIdx < currentFindings.length; cIdx++) {
      const cur = currentFindings[cIdx];
      if (!cur.fingerprint) continue;

      for (let pIdx = 0; pIdx < previousFindings.length; pIdx++) {
        if (matchedPreviousIndices.has(pIdx)) continue;
        const prev = previousFindings[pIdx];

        if (cur.fingerprint === prev.fingerprint) {
          matchedPairs.push({ current: cur, previous: prev, matchType: 'FINGERPRINT' });
          matchedCurrentIndices.add(cIdx);
          matchedPreviousIndices.add(pIdx);
          break;
        }
      }
    }

    // 2. Secondary Match: Structured Signature (Type + Normalized URL + Selector/Method/Role)
    for (let cIdx = 0; cIdx < currentFindings.length; cIdx++) {
      if (matchedCurrentIndices.has(cIdx)) continue;
      const cur = currentFindings[cIdx];
      const curSig = this.generateSignature(cur);

      for (let pIdx = 0; pIdx < previousFindings.length; pIdx++) {
        if (matchedPreviousIndices.has(pIdx)) continue;
        const prev = previousFindings[pIdx];
        const prevSig = this.generateSignature(prev);

        if (curSig === prevSig) {
          matchedPairs.push({ current: cur, previous: prev, matchType: 'SIGNATURE' });
          matchedCurrentIndices.add(cIdx);
          matchedPreviousIndices.add(pIdx);
          break;
        }
      }
    }

    const unmatchedCurrent = currentFindings.filter((_, idx) => !matchedCurrentIndices.has(idx));
    const unmatchedPrevious = previousFindings.filter((_, idx) => !matchedPreviousIndices.has(idx));

    return {
      matchedPairs,
      unmatchedCurrent,
      unmatchedPrevious,
    };
  }

  /**
   * Generates a deterministic secondary signature for structured finding comparison.
   */
  private static generateSignature(finding: HistoricalFinding): string {
    const normType = RunNormalizer.normalizeFindingType(finding.type);
    const normUrl = finding.targetUrl || '';
    const normSelector = finding.selector || '';
    const normMethod = finding.method ? finding.method.toUpperCase() : '';
    const normRole = finding.role || '';
    const normViewport = finding.viewport || '';

    return [normType, normUrl, normSelector, normMethod, normRole, normViewport].join('|');
  }
}
