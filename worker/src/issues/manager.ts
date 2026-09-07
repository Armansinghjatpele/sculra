// ==============================================================================
// Sculra Issue Persistence & Lifecycle Manager (worker/src/issues/manager.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { BugObservation, IssuePersistenceResult } from './types';
import { WorkerLogger } from '../logger';

export class IssueManager {
  private logger: WorkerLogger;

  constructor(logger?: WorkerLogger) {
    this.logger = logger || new WorkerLogger('issue_manager');
  }

  async persistBugs(
    supabase: SupabaseClient | null,
    bugs: BugObservation[],
    testRunId: string,
    projectId: string,
    organizationId?: string
  ): Promise<IssuePersistenceResult> {
    if (!bugs || bugs.length === 0) {
      return {
        persistedCount: 0,
        newIssuesCount: 0,
        updatedIssuesCount: 0,
        occurrencesCount: 0,
        issueIds: [],
      };
    }

    if (!supabase) {
      this.logger.warn('issue_persistence_skipped_no_supabase', {
        testRunId,
        bugsCount: bugs.length,
      });
      return {
        persistedCount: bugs.length,
        newIssuesCount: bugs.length,
        updatedIssuesCount: 0,
        occurrencesCount: bugs.length,
        issueIds: bugs.map((b) => b.id),
      };
    }

    let newIssuesCount = 0;
    let updatedIssuesCount = 0;
    let occurrencesCount = 0;
    const issueIds: string[] = [];

    for (const bug of bugs) {
      try {
        // 1. Query for existing issue with matching fingerprint on the same project
        const { data: existingIssues, error: queryErr } = await supabase
          .from('issues')
          .select('id, status, occurrence_count')
          .eq('project_id', projectId)
          .eq('fingerprint', bug.fingerprint)
          .limit(1);

        if (queryErr) {
          this.logger.warn('issue_query_error', { message: queryErr.message });
        }

        let issueId: string;
        const existing = existingIssues && existingIssues.length > 0 ? existingIssues[0] : null;

        if (!existing) {
          // 2. Insert new issue
          const { data: newIssue, error: insertErr } = await supabase
            .from('issues')
            .insert({
              project_id: projectId,
              organization_id: organizationId || null,
              test_run_id: testRunId,
              title: bug.title,
              description: bug.description,
              severity: bug.severity === 'info' ? 'low' : bug.severity,
              category: 'functional',
              status: 'open',
              fingerprint: bug.fingerprint,
              occurrence_count: 1,
              first_seen_at: bug.timestamp,
              last_seen_at: bug.timestamp,
              metadata: {
                type: bug.type,
                confidence: bug.confidence,
                summary: bug.summary,
                url: bug.url,
                action: bug.action,
                selector: bug.selector,
                errorSignature: bug.errorSignature,
                reproductionSteps: bug.reproductionSteps,
                journeyId: bug.journeyId,
                stepId: bug.stepId,
                ...bug.metadata,
              },
            })
            .select('id')
            .single();

          if (insertErr || !newIssue) {
            this.logger.warn('issue_insert_warning', {
              message: insertErr?.message || 'Failed to retrieve inserted issue ID',
            });
            continue;
          }

          issueId = newIssue.id;
          newIssuesCount++;
        } else {
          // 3. Existing issue: update occurrence count and last seen timestamp
          issueId = existing.id;
          const currentCount = existing.occurrence_count || 1;

          await supabase
            .from('issues')
            .update({
              test_run_id: testRunId,
              occurrence_count: currentCount + 1,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', issueId);

          updatedIssuesCount++;
        }

        issueIds.push(issueId);

        // 4. Record occurrence in issue_occurrences
        const { error: occErr } = await supabase
          .from('issue_occurrences')
          .insert({
            issue_id: issueId,
            test_run_id: testRunId,
            project_id: projectId,
            organization_id: organizationId || null,
            journey_id: bug.journeyId || null,
            step_id: bug.stepId || null,
            fingerprint: bug.fingerprint,
            metadata: {
              type: bug.type,
              url: bug.url,
              errorSignature: bug.errorSignature,
              reproductionSteps: bug.reproductionSteps,
            },
            observed_at: bug.timestamp,
          });

        if (!occErr) {
          occurrencesCount++;
        }

      } catch (err: any) {
        this.logger.error('bug_persistence_exception', {
          fingerprint: bug.fingerprint,
          message: err?.message || String(err),
        });
      }
    }

    this.logger.log('bug_persistence_completed', {
      totalBugs: bugs.length,
      newIssuesCount,
      updatedIssuesCount,
      occurrencesCount,
    });

    return {
      persistedCount: issueIds.length,
      newIssuesCount,
      updatedIssuesCount,
      occurrencesCount,
      issueIds,
    };
  }
}
