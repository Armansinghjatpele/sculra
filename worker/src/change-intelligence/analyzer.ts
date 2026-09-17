// ==============================================================================
// Sculra Master Change Intelligence Analyzer (worker/src/change-intelligence/analyzer.ts)
// ==============================================================================

import {
  ChangeAnalysisResult,
  ChangeAnalysisStatus,
  ChangeClassification,
  ChangedFile,
  ChangeSet,
} from './types';
import { IGitChangeProvider, RawChangedFile } from './git-provider';
import { GitHubChangeProvider } from './github';
import { parseUnifiedDiff } from './parser';
import { isBinaryFile, isDocumentation, isGeneratedOrMinified, isLockfile } from './normalizer';
import { classifyChangedFile } from './classifier';
import { classifyChangeSize } from './policy';
import { identifyAffectedRoutes } from './route-impact';
import { identifyAffectedApis } from './api-impact';
import { identifyProductImpact } from './product-impact';
import { identifyHistoricalImpact } from './historical-impact';
import { calculateChangeRisk } from './risk';
import { ImpactGraphBuilder } from './graph';
import { matchChangeToDomainsAndBoosts } from './matcher';
import { ProductModel } from '../product';
import { QASignalRecord, StabilitySignal, RegressionEvent } from '../history/types';

export interface ChangeAnalysisContext {
  projectId: string;
  organizationId?: string;
  campaignId?: string;
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  owner?: string;
  repo?: string;
  githubToken?: string;
  webhookPayloadFiles?: RawChangedFile[];
  unifiedDiffText?: string;
  gitProvider?: IGitChangeProvider;
  productModel?: ProductModel;
  historicalSignals?: QASignalRecord[];
  stabilitySignals?: StabilitySignal[];
  recentRegressions?: RegressionEvent[];
  knownRoutes?: string[];
  knownApiPaths?: string[];
}

export class ChangeIntelligenceAnalyzer {
  private gitProvider: IGitChangeProvider;

  constructor(options?: IGitChangeProvider | { gitProvider?: IGitChangeProvider; supabaseClient?: any; logger?: any }) {
    if (options && 'fetchChanges' in options) {
      this.gitProvider = options;
    } else if (options && typeof options === 'object' && 'gitProvider' in options && options.gitProvider) {
      this.gitProvider = options.gitProvider;
    } else {
      this.gitProvider = new GitHubChangeProvider();
    }
  }

  /**
   * Executes the full deterministic code change intelligence and impact analysis.
   */
  async analyze(context: ChangeAnalysisContext): Promise<ChangeAnalysisResult> {
    const startTime = Date.now();
    const {
      projectId,
      campaignId,
      commitSha,
      baseSha,
      branch,
      pullRequestNumber,
      owner = '',
      repo = '',
      githubToken,
      webhookPayloadFiles,
      unifiedDiffText,
      productModel,
      historicalSignals = [],
      stabilitySignals = [],
      recentRegressions = [],
      knownRoutes = [],
      knownApiPaths = [],
    } = context;

    // 1. Fetch raw changes from Git Provider
    const rawData = await this.gitProvider.fetchChanges({
      owner,
      repo,
      commitSha,
      baseSha,
      branch,
      pullRequestNumber,
      githubToken,
      webhookPayloadFiles,
      unifiedDiffText,
    });

    let isPartial = rawData.isPartial;
    let partialReason = rawData.partialReason;

    // 2. Parse diffs and classify files
    const changedFiles: ChangedFile[] = [];
    const allClassifications = new Set<ChangeClassification>();

    for (const rf of rawData.files) {
      const isBinary = isBinaryFile(rf.filename);
      const isLock = isLockfile(rf.filename);
      const isDoc = isDocumentation(rf.filename);
      const isGen = isGeneratedOrMinified(rf.filename);

      let hunks: any[] = [];
      let additions = rf.additions;
      let deletions = rf.deletions;

      if (!isBinary && rf.patch) {
        const parsedDiff = parseUnifiedDiff(rf.patch);
        hunks = parsedDiff.hunks;
        if (parsedDiff.isTruncated) {
          isPartial = true;
          partialReason = parsedDiff.truncationReason || 'File diff truncated due to execution limit';
        }
        if (additions === 0 && deletions === 0) {
          additions = parsedDiff.additions;
          deletions = parsedDiff.deletions;
        }
      }

      const classifications = classifyChangedFile(rf.filename, hunks);
      for (const c of classifications) allClassifications.add(c);

      changedFiles.push({
        path: rf.filename,
        previousPath: rf.previousFilename,
        status: rf.status,
        additions,
        deletions,
        changes: rf.changes || additions + deletions,
        hunks,
        isBinary,
        isGeneratedOrMinified: isGen,
        isLockfile: isLock,
        isDocumentation: isDoc,
        classifications,
        patch: rf.patch,
      });
    }

    const totalLines = rawData.totalAdditions + rawData.totalDeletions;
    const sizeCategory = classifyChangeSize(changedFiles.length, totalLines);

    // 3. Build ChangeSet Model
    const changeSet: ChangeSet = {
      id: `cs-${commitSha.slice(0, 7)}-${Date.now().toString(36)}`,
      commitSha,
      baseSha,
      branch,
      pullRequestNumber,
      files: changedFiles,
      totalAdditions: rawData.totalAdditions,
      totalDeletions: rawData.totalDeletions,
      sizeCategory,
      isPartial,
      partialReason,
      createdAt: new Date().toISOString(),
    };

    // 4. Map Route Impact
    const filePaths = changedFiles.map((f) => f.path);
    const affectedRoutes = identifyAffectedRoutes(filePaths, knownRoutes);

    // 5. Map API Impact
    const affectedApis = identifyAffectedApis({ changedFiles, knownApiPaths });

    // 6. Map Product Model Impact (Workflows, Features, Roles)
    const affectedWorkflows = identifyProductImpact({
      productModel,
      affectedRoutes,
      affectedApis,
      changedFiles,
    });

    // 7. Cross-reference Historical QA Memory
    const historicalAssociations = identifyHistoricalImpact({
      changedFiles,
      affectedRoutes,
      affectedApis,
      historicalSignals,
      stabilitySignals,
      recentRegressions,
    });

    // 8. Deterministic Change Risk Calculation
    const classificationsList = Array.from(allClassifications);
    const risk = calculateChangeRisk({
      changeSet,
      classifications: classificationsList,
      affectedWorkflows,
      affectedApis,
      historicalAssociations,
    });

    // 9. Build Bounded Impact Graph
    const graphBuilder = new ImpactGraphBuilder();

    // Add file nodes
    for (const f of changedFiles) {
      graphBuilder.addNode(f.path, 'FILE', f.path, { status: f.status, additions: f.additions, deletions: f.deletions });
    }

    // Add route nodes & edges
    for (const r of affectedRoutes) {
      graphBuilder.addNode(r.route, 'ROUTE', r.route);
      // Link corresponding file to route
      for (const f of changedFiles) {
        if (r.reason.includes(f.path)) {
          graphBuilder.addEdge(f.path, r.route, 'SERVES', r.reason, r.confidence);
        }
      }
    }

    // Add API nodes & edges
    for (const a of affectedApis) {
      graphBuilder.addNode(a.path, 'API', a.path, { method: a.method });
      for (const f of changedFiles) {
        if (a.reason.includes(f.path)) {
          graphBuilder.addEdge(f.path, a.path, 'SERVES', a.reason, a.confidence);
        }
      }
    }

    // Add Workflow nodes & edges
    for (const wf of affectedWorkflows) {
      graphBuilder.addNode(wf.workflowId, 'WORKFLOW', wf.workflowName, { criticality: wf.criticality });
      for (const r of affectedRoutes) {
        if (wf.reason.includes(r.route)) {
          graphBuilder.addEdge(r.route, wf.workflowId, 'PART_OF', wf.reason, wf.confidence);
        }
      }
    }

    // Add Historical nodes & edges
    for (const h of historicalAssociations) {
      graphBuilder.addNode(`hist-${h.targetIdentifier}`, 'HISTORICAL_FINDING', h.signalType, { target: h.targetIdentifier });
      graphBuilder.addEdge(h.targetIdentifier, `hist-${h.targetIdentifier}`, 'FAILED_BEFORE', h.reason, h.confidence);
    }

    const impactGraph = graphBuilder.build();

    // 10. Recommend Domains and Produce Strategy Boosts
    const { recommendedDomains, strategyBoosts } = matchChangeToDomainsAndBoosts({
      classifications: classificationsList,
      affectedRoutes,
      affectedApis,
      affectedWorkflows,
      historicalAssociations,
    });

    // 11. Determine Final Analysis Status
    let status: ChangeAnalysisStatus = 'COMPLETED';
    if (changedFiles.length === 0 && isPartial) {
      status = 'NOT_AVAILABLE';
    } else if (isPartial || impactGraph.isTruncated) {
      status = 'PARTIAL';
    }

    const durationMs = Date.now() - startTime;

    const summary = {
      headline: `Change Intelligence: ${changedFiles.length} file(s) changed, Risk ${risk.score}/100 (${risk.level})`,
      markdownSummary: `Analyzed ${changedFiles.length} file(s). ${affectedRoutes.length} route(s), ${affectedWorkflows.length} workflow(s), and ${affectedApis.length} API(s) affected.`,
      riskScore: risk.score,
      riskLevel: risk.level,
    };

    return {
      id: `ca-${commitSha.slice(0, 7)}-${Date.now().toString(36)}`,
      projectId,
      campaignId,
      commitSha,
      baseSha,
      branch,
      pullRequestNumber,
      status,
      changeSet,
      classifications: classificationsList,
      impactGraph,
      risk,
      affectedWorkflows,
      affectedApis,
      affectedRoutes,
      recommendedDomains,
      strategyBoosts,
      summary,
      isPartial: status === 'PARTIAL' || isPartial,
      analyzedAt: new Date().toISOString(),
      durationMs,
    };
  }
}
