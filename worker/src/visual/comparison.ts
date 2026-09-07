// ==============================================================================
// Sculra Deterministic Image Comparison Engine (worker/src/visual/comparison.ts)
// ==============================================================================

import { PNG } from 'pngjs';
import { VisualComparison, VisualComparisonStatus, ViewportProfile } from './types';

export interface ComparisonOptions {
  threshold?: number; // Per-pixel color tolerance (0 to 1, default 0.1)
  thresholds?: {
    pass: number;
    info: number;
    medium: number;
    high: number;
  };
}

export const DEFAULT_THRESHOLDS = {
  pass: 0.001, // < 0.1%
  info: 0.01, // 0.1% to 1%
  medium: 0.05, // 1% to 5%
  high: 0.05, // > 5%
};

export class VisualComparator {
  compareBuffers(
    baselineBuffer: Buffer,
    currentBuffer: Buffer,
    pageUrl: string,
    viewport: ViewportProfile,
    options: ComparisonOptions = {}
  ): VisualComparison {
    const baselinePng = PNG.sync.read(baselineBuffer);
    const currentPng = PNG.sync.read(currentBuffer);

    // Assert dimension equality
    if (
      baselinePng.width !== currentPng.width ||
      baselinePng.height !== currentPng.height
    ) {
      return {
        id: `comp-${Math.random().toString(36).substring(2, 10)}`,
        currentId: 'current',
        pageUrl,
        viewport,
        pixelDifferenceRatio: 1.0,
        changedPixelCount: baselinePng.width * baselinePng.height,
        totalPixelCount: baselinePng.width * baselinePng.height,
        status: 'DIMENSION_MISMATCH',
        threshold: 0,
        timestamp: new Date().toISOString(),
        metadata: {
          baselineDimensions: { width: baselinePng.width, height: baselinePng.height },
          currentDimensions: { width: currentPng.width, height: currentPng.height },
        },
      };
    }

    const width = baselinePng.width;
    const height = baselinePng.height;
    const totalPixelCount = width * height;

    const diffPng = new PNG({ width, height });
    const pixelTolerance = (options.threshold ?? 0.1) * 255;

    let changedPixelCount = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;

        const r1 = baselinePng.data[idx];
        const g1 = baselinePng.data[idx + 1];
        const b1 = baselinePng.data[idx + 2];
        const a1 = baselinePng.data[idx + 3];

        const r2 = currentPng.data[idx];
        const g2 = currentPng.data[idx + 1];
        const b2 = currentPng.data[idx + 2];
        const a2 = currentPng.data[idx + 3];

        const deltaR = Math.abs(r1 - r2);
        const deltaG = Math.abs(g1 - g2);
        const deltaB = Math.abs(b1 - b2);
        const deltaA = Math.abs(a1 - a2);

        const delta = Math.max(deltaR, deltaG, deltaB, deltaA);

        if (delta > pixelTolerance) {
          changedPixelCount++;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;

          // Highlight diff in red
          diffPng.data[idx] = 255;
          diffPng.data[idx + 1] = 0;
          diffPng.data[idx + 2] = 0;
          diffPng.data[idx + 3] = 255;
        } else {
          // Faded original pixel for context
          diffPng.data[idx] = r2;
          diffPng.data[idx + 1] = g2;
          diffPng.data[idx + 2] = b2;
          diffPng.data[idx + 3] = Math.round(a2 * 0.4);
        }
      }
    }

    const pixelDifferenceRatio = totalPixelCount > 0 ? changedPixelCount / totalPixelCount : 0;
    const thresholds = options.thresholds || DEFAULT_THRESHOLDS;

    let status: VisualComparisonStatus = 'PASS';
    if (pixelDifferenceRatio > thresholds.medium) {
      status = 'HIGH';
    } else if (pixelDifferenceRatio > thresholds.info) {
      status = 'MEDIUM';
    } else if (pixelDifferenceRatio > thresholds.pass) {
      status = 'INFO';
    }

    const boundingRegion =
      changedPixelCount > 0
        ? {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1,
          }
        : undefined;

    const diffBuffer = PNG.sync.write(diffPng);

    return {
      id: `comp-${Math.random().toString(36).substring(2, 10)}`,
      currentId: 'current',
      pageUrl,
      viewport,
      pixelDifferenceRatio: Math.round(pixelDifferenceRatio * 10000) / 10000,
      changedPixelCount,
      totalPixelCount,
      boundingRegion,
      status,
      threshold: thresholds.medium,
      diffBuffer,
      timestamp: new Date().toISOString(),
      metadata: {
        width,
        height,
        thresholds,
      },
    };
  }
}
