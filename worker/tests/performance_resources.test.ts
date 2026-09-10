// ==============================================================================
// Unit Test: Resource Performance Evaluator (worker/tests/performance_resources.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { ResourcePerformanceEvaluator } from '../src/performance/resources';
import { DEFAULT_PERFORMANCE_POLICY } from '../src/performance/policy';

describe('ResourcePerformanceEvaluator', () => {
  it('identifies oversized, slow, and duplicate resource assets from performance entries', async () => {
    const mockResources = [
      {
        name: 'http://localhost/assets/bundle.js',
        initiatorType: 'script',
        startTime: 10,
        duration: 250,
        transferSize: 3 * 1024 * 1024, // 3MB (exceeds 1.5MB threshold for scripts)
        encodedBodySize: 3 * 1024 * 1024,
        decodedBodySize: 3 * 1024 * 1024,
      },
      {
        name: 'http://localhost/assets/hero.png',
        initiatorType: 'img',
        startTime: 20,
        duration: 1800, // > 1500ms
        transferSize: 2.5 * 1024 * 1024, // 2.5MB (exceeds 1MB for images)
        encodedBodySize: 2.5 * 1024 * 1024,
        decodedBodySize: 2.5 * 1024 * 1024,
      },
      {
        name: 'http://localhost/assets/hero.png', // Duplicate asset
        initiatorType: 'img',
        startTime: 100,
        duration: 50,
        transferSize: 2.5 * 1024 * 1024,
        encodedBodySize: 2.5 * 1024 * 1024,
        decodedBodySize: 2.5 * 1024 * 1024,
      },
      {
        name: 'http://localhost/assets/style.css',
        initiatorType: 'css',
        startTime: 5,
        duration: 40,
        transferSize: 35 * 1024, // 35KB (healthy)
        encodedBodySize: 35 * 1024,
        decodedBodySize: 120 * 1024,
      },
    ];

    const mockPage: any = {
      evaluate: async () => mockResources,
    };

    const results = await ResourcePerformanceEvaluator.evaluatePageResources(
      mockPage,
      'http://localhost/dashboard',
      DEFAULT_PERFORMANCE_POLICY
    );

    expect(results.length).toBe(4);
    const oversized = results.filter((r) => r.isOversized);
    expect(oversized.length).toBeGreaterThanOrEqual(2);

    const duplicates = results.filter((r) => r.isDuplicate);
    expect(duplicates.length).toBeGreaterThanOrEqual(2);
  });
});
