// ==============================================================================
// Sculra Accessibility & Inclusive UX Adapter (worker/src/campaign/adapters/accessibility.ts)
// ==============================================================================

import { Page, BrowserContext, Browser } from 'playwright';
import { CampaignTask, CampaignTaskResult } from '../types';
import { AccessibilityScanner, AccessibilityScanResult } from '../../accessibility';
import { ApplicationMap } from '../../types';
import { ProductModel } from '../../product';

export class AccessibilityAdapter {
  static async execute(
    task: CampaignTask,
    page: Page,
    context: BrowserContext,
    targetUrl: string,
    appMap?: ApplicationMap,
    productModel?: ProductModel,
    policy?: any,
    browser?: Browser,
    allowLocalhost?: boolean
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const scanner = new AccessibilityScanner(policy || {});
      const scanResult: AccessibilityScanResult = await scanner.scan({
        testRunId: task.id,
        projectId: task.target.identifier || 'unknown',
        targetUrl,
        page,
        browser,
        browserContext: context,
        applicationMap: appMap,
        productModel,
        allowLocalhost,
      });

      const criticalFindings = scanResult.findings.filter((f) => f.severity === 'critical');
      const highFindings = scanResult.findings.filter((f) => f.severity === 'high');
      const score = scanResult.coverage?.accessibilityScore;

      return {
        taskId: task.id,
        status: criticalFindings.length > 0 || highFindings.length > 0 ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: 'ACCESSIBILITY',
        findings: scanResult.findings,
        evidence: [
          {
            type: 'accessibility_summary',
            title: `Accessibility Scan: ${scanResult.findings.length} findings${score !== undefined ? ` (Score: ${score}/100)` : ''}`,
            url: targetUrl,
            metadata: { coverage: scanResult.coverage, score },
          },
          ...scanResult.findings.map((f) => ({
            type: 'accessibility_finding',
            title: `[${f.severity.toUpperCase()}] ${f.title}`,
            url: f.targetUrl || targetUrl,
            metadata: { finding: f },
          })),
        ],
        observations: scanResult.bugObservations || [],
        durationMs: Date.now() - startTime,
        coverage: {
          pagesEvaluated: scanResult.coverage?.pagesTested || 0,
          rulesAudited: scanResult.coverage?.totalChecks || 0,
        },
        metadata: { scanResult },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'ACCESSIBILITY',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Accessibility QA execution failed',
      };
    }
  }
}

