// ==============================================================================
// Sculra Deterministic Source Fingerprinting & Change Detector
// (worker/src/sources/source-fingerprint.ts)
// ==============================================================================

import * as crypto from 'crypto';
import {
  SourceFingerprint,
  SourceChange,
  SourceType,
} from './types';

export class SourceFingerprinter {
  /**
   * Generates a deterministic SHA-256 fingerprint from genuine source properties.
   */
  static compute(
    sourceType: SourceType,
    components: Record<string, string | number | undefined | null>
  ): SourceFingerprint {
    // Sort keys deterministically
    const sortedKeys = Object.keys(components).sort();
    const normalizedMap: Record<string, string> = {};
    const parts: string[] = [`type:${sourceType}`];

    for (const key of sortedKeys) {
      const val = components[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const strVal = String(val).trim();
        normalizedMap[key] = strVal;
        parts.push(`${key}:${strVal}`);
      }
    }

    const payload = parts.join('|');
    const hash = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      hash,
      components: normalizedMap,
      observedAt: new Date().toISOString(),
    };
  }

  /**
   * Compares two snapshots to produce a deterministic SourceChange event.
   */
  static detectChange(
    sourceId: string,
    previousFingerprint?: string,
    currentFingerprint?: string,
    details?: {
      prevRevision?: string;
      currRevision?: string;
      prevStatus?: string;
      currStatus?: string;
    }
  ): SourceChange {
    const timestamp = new Date().toISOString();

    if (!previousFingerprint) {
      return {
        type: 'SOURCE_CONNECTED',
        sourceId,
        currentFingerprint: currentFingerprint || '',
        details: 'Initial connection established and baseline snapshot created.',
        timestamp,
      };
    }

    if (previousFingerprint === currentFingerprint) {
      return {
        type: 'SOURCE_UNCHANGED',
        sourceId,
        previousFingerprint,
        currentFingerprint: currentFingerprint || '',
        details: 'Source fingerprint matches prior observation; no code or environment changes detected.',
        timestamp,
      };
    }

    if (details?.currStatus === 'UNAVAILABLE' && details?.prevStatus !== 'UNAVAILABLE') {
      return {
        type: 'SOURCE_UNAVAILABLE',
        sourceId,
        previousFingerprint,
        currentFingerprint: currentFingerprint || '',
        details: 'Target source transitioned to UNAVAILABLE or unreachable status.',
        timestamp,
      };
    }

    if (details?.prevRevision && details?.currRevision && details.prevRevision !== details.currRevision) {
      return {
        type: 'SOURCE_REVISION_CHANGED',
        sourceId,
        previousFingerprint,
        currentFingerprint: currentFingerprint || '',
        details: `Source revision changed from ${details.prevRevision} to ${details.currRevision}.`,
        timestamp,
        metadata: {
          previousRevision: details.prevRevision,
          currentRevision: details.currRevision,
        },
      };
    }

    return {
      type: 'SOURCE_CHANGED',
      sourceId,
      previousFingerprint,
      currentFingerprint: currentFingerprint || '',
      details: 'Source attributes, environment, or target headers changed since prior snapshot.',
      timestamp,
    };
  }
}
