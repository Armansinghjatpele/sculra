// ==============================================================================
// Sculra Security & Authorization Adapter (worker/src/campaign/adapters/security.ts)
// ==============================================================================

import { CampaignTask, CampaignTaskResult } from '../types';
import { SecurityScanner, SecurityScanResult } from '../../security';
import { ApplicationMap } from '../../types';
import { ApiEndpoint } from '../../api-qa';
import { RoleContext, AuthenticatedSession } from '../../auth';

export class SecurityAdapter {
  static async execute(
    task: CampaignTask,
    targetUrl: string,
    context: {
      appMap?: ApplicationMap;
      apiEndpoints?: ApiEndpoint[];
      roleContexts?: RoleContext[];
      sessions?: AuthenticatedSession[];
      policy?: any;
      allowLocalhost?: boolean;
    } = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const scanner = new SecurityScanner(context.policy || {});
      const scanResult: SecurityScanResult = await scanner.scan({
        testRunId: task.id,
        projectId: task.target.identifier || 'unknown',
        targetUrl,
        applicationMap: context.appMap,
        apiEndpoints: context.apiEndpoints || [],
        roleContexts: context.roleContexts || [],
        authenticatedSessions: context.sessions || [],
        allowLocalhost: context.allowLocalhost,
      });

      const criticalFindings = scanResult.findings.filter((f) => f.severity === 'critical');
      const highFindings = scanResult.findings.filter((f) => f.severity === 'high');

      return {
        taskId: task.id,
        status: criticalFindings.length > 0 || highFindings.length > 0 ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: 'SECURITY',
        findings: scanResult.findings,
        evidence: [
          {
            type: 'security_summary',
            title: `Security Scan: ${scanResult.findings.length} findings (Score: ${scanResult.securityScore}/100)`,
            url: targetUrl,
            metadata: { coverage: scanResult.coverage, score: scanResult.securityScore },
          },
          ...scanResult.findings.map((f) => ({
            type: 'security_finding',
            title: `[${f.severity.toUpperCase()}] ${f.title}`,
            url: f.targetUrl || targetUrl,
            metadata: { finding: f },
          })),
        ],
        observations: scanResult.bugObservations || [],
        durationMs: Date.now() - startTime,
        coverage: {
          rulesAudited: scanResult.coverage?.checksExecuted || 0,
        },
        metadata: { scanResult },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'SECURITY',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Security QA execution failed',
      };
    }
  }
}

