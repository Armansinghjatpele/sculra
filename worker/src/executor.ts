// ==============================================================================
// Sculra Test Worker Job Executor (worker/src/executor.ts)
// ==============================================================================
// Orchestrates test job execution: updates DB states, invokes Playwright runner,
// saves evidence rows, and reports final status.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BrowserRunner } from './runner';
import { SupabaseEvidenceStorage, IEvidenceStorage, LocalEvidenceStorage } from './storage';
import { WorkerLogger } from './logger';
import { CancellationToken } from './types';

export interface ExecutorConfig {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  supabaseClient?: SupabaseClient;
  storage?: IEvidenceStorage;
}

export class JobExecutor {
  private supabase: SupabaseClient | null = null;
  private storage: IEvidenceStorage;

  constructor(config: ExecutorConfig = {}) {
    const url = config.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      config.supabaseServiceKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (config.supabaseClient) {
      this.supabase = config.supabaseClient;
    } else if (url && key) {
      this.supabase = createClient(url, key, {
        auth: { persistSession: false },
      });
    }

    if (config.storage) {
      this.storage = config.storage;
    } else if (this.supabase) {
      this.storage = new SupabaseEvidenceStorage(this.supabase);
    } else {
      this.storage = new LocalEvidenceStorage();
    }
  }

  async executeTestRun(
    testRunId: string,
    cancellationToken?: CancellationToken
  ): Promise<{ success: boolean; status: string; error?: string }> {
    const logger = new WorkerLogger(testRunId);
    logger.log('job_execution_initiated');

    if (!this.supabase) {
      logger.error('supabase_client_missing', 'Supabase credentials are not configured.');
      return { success: false, status: 'failed', error: 'Database client not configured' };
    }

    // 1. Fetch Test Run & Project details
    const { data: testRun, error: trError } = await this.supabase
      .from('test_runs')
      .select('*, projects(*)')
      .eq('id', testRunId)
      .single();

    if (trError || !testRun) {
      logger.error('test_run_fetch_failed', trError?.message || 'Test run not found');
      return { success: false, status: 'failed', error: 'Test run record not found' };
    }

    const project = testRun.projects;
    if (!project) {
      logger.error('project_not_found', 'Associated project record is missing.');
      await this.updateTestRunState(testRunId, 'failed', {
        completed_at: new Date().toISOString(),
      });
      return { success: false, status: 'failed', error: 'Project record not found' };
    }

    // 2. Validate Project Source Type
    if (project.source_type !== 'website') {
      logger.error('unsupported_source_type', `Source type "${project.source_type}" is not supported for browser testing.`);
      await this.updateTestRunState(testRunId, 'failed', {
        completed_at: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'failed',
        error: `Only "website" projects can be browser tested (got ${project.source_type}).`,
      };
    }

    const targetUrl = project.source_url || project.url;
    if (!targetUrl) {
      logger.error('missing_target_url', 'Project does not have a source_url configured.');
      await this.updateTestRunState(testRunId, 'failed', {
        completed_at: new Date().toISOString(),
      });
      return { success: false, status: 'failed', error: 'Target URL is missing.' };
    }

    // 3. Mark Test Run as RUNNING
    const startedAt = new Date().toISOString();
    await this.updateTestRunState(testRunId, 'running', {
      started_at: startedAt,
    });
    logger.log('test_run_state_updated_to_running');

    // 4. Execute Browser Test Runner
    const runner = new BrowserRunner(testRunId, project.id);
    const result = await runner.run(targetUrl, cancellationToken);

    // 5. Persist Evidence Records
    const completedAt = new Date().toISOString();

    try {
      // 5a. Save Screenshots
      for (let i = 0; i < result.screenshots.length; i++) {
        const item = result.screenshots[i];
        const upload = await this.storage.uploadScreenshot(
          testRunId,
          `screenshot_${i + 1}.png`,
          item.buffer,
          item.mimeType
        );

        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'screenshot',
          title: item.title || `Viewport Capture ${i + 1}`,
          url: result.finalUrl || targetUrl,
          storage_path: upload.storagePath,
          message: upload.publicUrl,
          metadata: {
            width: 1280,
            height: 720,
            publicUrl: upload.publicUrl,
          },
        });
      }

      // 5b. Save Console Errors
      for (const err of result.consoleErrors) {
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'console_error',
          title: 'Browser Console Error',
          url: err.url || targetUrl,
          message: err.message,
          metadata: {
            location: err.location,
            timestamp: err.timestamp,
          },
        });
      }

      // 5c. Save Network Errors
      for (const net of result.networkErrors) {
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'network_error',
          title: `Network Failure (${net.method} ${net.status || 'Failed'})`,
          url: net.url,
          message: net.errorText || 'Request failed',
          metadata: {
            method: net.method,
            status: net.status,
            resourceType: net.resourceType,
            timestamp: net.timestamp,
          },
        });
      }

      // 5d. Save Navigation Snapshot
      await this.supabase.from('test_evidence').insert({
        test_run_id: testRunId,
        project_id: project.id,
        type: 'navigation',
        title: 'Initial Page Navigation',
        url: result.finalUrl || targetUrl,
        message: result.pageTitle || 'Navigation Completed',
        metadata: {
          targetUrl,
          finalUrl: result.finalUrl,
          pageTitle: result.pageTitle,
          statusCode: result.statusCode,
          durationMs: result.durationMs,
        },
      });

      // 5e. Save Application Discovery Map
      if (result.applicationMap) {
        await this.supabase.from('test_evidence').insert({
          test_run_id: testRunId,
          project_id: project.id,
          type: 'application_map',
          title: `Application Discovery Map (${result.applicationMap.totalPages} Pages Mapped)`,
          url: result.applicationMap.startUrl,
          message: `Discovered ${result.applicationMap.totalPages} pages, ${result.applicationMap.totalForms} forms, ${result.applicationMap.totalButtons} buttons, and ${result.applicationMap.totalLinks} links.`,
          metadata: {
            applicationMap: result.applicationMap,
          },
        });
      }

    } catch (evidenceErr: any) {
      logger.warn('evidence_persistence_warning', { message: evidenceErr.message });
    }

    // 6. Update Test Run Final Status (overall_score remains null until AI scoring engine is built)
    await this.updateTestRunState(testRunId, result.status, {
      completed_at: completedAt,
      duration_ms: result.durationMs,
      overall_score: null,
    });

    logger.log('job_execution_finished', {
      finalStatus: result.status,
      durationMs: result.durationMs,
    });

    return {
      success: result.status === 'passed',
      status: result.status,
      error: result.failureReason,
    };
  }

  private async updateTestRunState(
    testRunId: string,
    status: string,
    additionalFields: Record<string, any> = {}
  ) {
    if (!this.supabase) return;
    try {
      await this.supabase
        .from('test_runs')
        .update({
          status,
          updated_at: new Date().toISOString(),
          ...additionalFields,
        })
        .eq('id', testRunId);
    } catch (err) {
      console.error(`[JobExecutor]: Failed updating test run state to ${status}`, err);
    }
  }
}
