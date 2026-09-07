// ==============================================================================
// Sculra Visual Baseline Manager (worker/src/visual/baseline.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { VisualSnapshot, ViewportProfile } from './types';
import { WorkerLogger } from '../logger';

export class BaselineManager {
  private inMemoryBaselines: Map<string, VisualSnapshot> = new Map();
  private logger: WorkerLogger;

  constructor(logger?: WorkerLogger) {
    this.logger = logger || new WorkerLogger('baseline_manager');
  }

  getBaselineKey(projectId: string, pageUrl: string, viewportName: string): string {
    return `${projectId}:${pageUrl}:${viewportName.toLowerCase()}`;
  }

  registerInMemoryBaseline(snapshot: VisualSnapshot): void {
    const key = this.getBaselineKey(snapshot.projectId, snapshot.pageUrl, snapshot.viewport.name);
    this.inMemoryBaselines.set(key, snapshot);
  }

  async getBaseline(
    supabase: SupabaseClient | null,
    projectId: string,
    pageUrl: string,
    viewport: ViewportProfile
  ): Promise<VisualSnapshot | null> {
    const key = this.getBaselineKey(projectId, pageUrl, viewport.name);

    // 1. Check in-memory baselines (useful for test fixtures)
    if (this.inMemoryBaselines.has(key)) {
      return this.inMemoryBaselines.get(key) || null;
    }

    if (!supabase) {
      return null;
    }

    // 2. Query test_evidence for latest approved baseline
    try {
      const { data, error } = await supabase
        .from('test_evidence')
        .select('*')
        .eq('project_id', projectId)
        .eq('type', 'visual_baseline')
        .eq('url', pageUrl)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        testRunId: data.test_run_id,
        projectId: data.project_id,
        pageUrl: data.url,
        viewport,
        width: data.metadata?.width || viewport.width,
        height: data.metadata?.height || viewport.height,
        storageUrl: data.message || data.storage_path,
        capturedAt: data.created_at,
        metadata: data.metadata,
      };
    } catch (err: any) {
      this.logger.warn('baseline_fetch_failed', { message: err.message });
      return null;
    }
  }
}
