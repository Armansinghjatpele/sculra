// ==============================================================================
// Sculra Bounded Source Cache (worker/src/sources/source-cache.ts)
// ==============================================================================

import { SOURCE_POLICY } from './policy';
import { SourceValidationResult } from './types';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SourceCache {
  private static cache = new Map<string, CacheEntry<any>>();
  private static MAX_ENTRIES = 500;

  private static buildKey(projectId: string, sourceType: string, locator: string): string {
    return `${projectId}:${sourceType.toUpperCase()}:${locator.trim()}`;
  }

  static get<T>(projectId: string, sourceType: string, locator: string): T | null {
    const key = this.buildKey(projectId, sourceType, locator);
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  static set<T>(
    projectId: string,
    sourceType: string,
    locator: string,
    value: T,
    ttlMs: number = SOURCE_POLICY.CACHE_TTL_MS
  ): void {
    if (this.cache.size >= this.MAX_ENTRIES) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    const key = this.buildKey(projectId, sourceType, locator);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  static invalidate(projectId: string, sourceType?: string, locator?: string): void {
    if (!sourceType || !locator) {
      // Invalidate all for project
      for (const key of Array.from(this.cache.keys())) {
        if (key.startsWith(`${projectId}:`)) {
          this.cache.delete(key);
        }
      }
      return;
    }

    const key = this.buildKey(projectId, sourceType, locator);
    this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
  }
}
