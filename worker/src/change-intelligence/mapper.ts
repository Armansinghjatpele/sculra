import { ImpactGraphBuilder } from './graph';
import {
  ChangedFile,
  AffectedRoute,
  AffectedApi,
  AffectedWorkflow,
  ImpactGraph,
  EnvironmentSnapshot,
} from './types';
import { ProductModel } from '../product';
import { extractSymbolsFromHunks } from './symbol-impact';
import { QASignalRecord } from '../history/types';

export interface ImpactMapperInput {
  changedFiles: ChangedFile[];
  affectedRoutes: AffectedRoute[];
  affectedApis: AffectedApi[];
  affectedWorkflows: AffectedWorkflow[];
  productModel?: ProductModel;
  historicalSignals?: QASignalRecord[];
  baseBranch?: string;
  headBranch?: string;
  baseCommit?: string;
  headCommit?: string;
  environment?: EnvironmentSnapshot;
  deployment?: {
    deploymentId?: string | null;
    deploymentStatus?: string | null;
    environmentId?: string | null;
    commitSha?: string | null;
  };
}

export class ImpactMapper {
  /**
   * Constructs the full canonical multi-tier ImpactGraph:
   * Branch -> Commit -> File -> Function/Export -> Route/API -> Workflow -> QA Target -> Environment.
   */
  static buildImpactGraph(input: ImpactMapperInput): ImpactGraph {
    const {
      changedFiles,
      affectedRoutes,
      affectedApis,
      affectedWorkflows,
      productModel,
      historicalSignals = [],
      baseBranch,
      headBranch,
      baseCommit,
      headCommit,
      environment,
      deployment,
    } = input;

    const builder = new ImpactGraphBuilder();

    // 0. Branch & Commit Nodes & Edges
    if (headBranch) {
      builder.addNode(`branch:${headBranch}`, 'BRANCH', headBranch, { kind: 'head' });
    }
    if (baseBranch) {
      builder.addNode(`branch:${baseBranch}`, 'BRANCH', baseBranch, { kind: 'base' });
    }
    if (headCommit) {
      builder.addNode(`commit:${headCommit}`, 'COMMIT', headCommit.slice(0, 7), { fullSha: headCommit });
      if (headBranch) {
        builder.addEdge(`branch:${headBranch}`, `commit:${headCommit}`, 'HEAD_COMMIT', `Head commit of branch ${headBranch}`, 'HIGH');
      }
    }
    if (baseCommit) {
      builder.addNode(`commit:${baseCommit}`, 'COMMIT', baseCommit.slice(0, 7), { fullSha: baseCommit });
      if (baseBranch) {
        builder.addEdge(`branch:${baseBranch}`, `commit:${baseCommit}`, 'BASE_COMMIT', `Base commit of branch ${baseBranch}`, 'HIGH');
      }
    }

    // 0.5 Environment Node
    if (environment && environment.environmentId) {
      builder.addNode(`env:${environment.environmentId}`, 'ENVIRONMENT', environment.environmentName || environment.environmentId, {
        type: environment.environmentType,
        targetUrl: environment.targetUrl,
        branch: environment.branch,
        commitSha: environment.commitSha,
      });
    }

    // 0.6 Deployment Node & Edges
    if (deployment && deployment.deploymentId) {
      const depNodeId = `deployment:${deployment.deploymentId}`;
      builder.addNode(depNodeId, 'DEPLOYMENT', deployment.deploymentId, {
        status: deployment.deploymentStatus,
        commitSha: deployment.commitSha,
      });

      if (deployment.environmentId) {
        builder.addEdge(depNodeId, `env:${deployment.environmentId}`, 'DEPLOYED_TO', `Deployment deployed to environment ${deployment.environmentId}`, 'HIGH');
      }
      if (deployment.commitSha) {
        builder.addEdge(depNodeId, `commit:${deployment.commitSha}`, 'DEPLOYED_COMMIT', `Deployment contains commit ${deployment.commitSha.slice(0, 7)}`, 'HIGH');
      }
    }

    // 1. FILE Nodes
    for (const f of changedFiles) {
      builder.addNode(f.path, 'FILE', f.path, {
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        classifications: f.classifications,
      });

      if (headCommit) {
        builder.addEdge(`commit:${headCommit}`, f.path, 'CHANGED_FILE', `Touched in commit ${headCommit.slice(0, 7)}`, 'HIGH');
      }

      // 2. FUNCTION / SYMBOL Nodes (extracted from diff hunks)
      if (f.hunks && f.hunks.length > 0) {
        const symbolImpact = extractSymbolsFromHunks(f.hunks);
        for (const exp of symbolImpact.exports) {
          const symId = `${f.path}#${exp}`;
          builder.addNode(symId, 'FUNCTION', exp, {
            filePath: f.path,
            kind: 'function',
            exported: true,
          });
          builder.addEdge(f.path, symId, 'CHANGED_SYMBOL', `Modified function/symbol ${exp}`, 'HIGH');
        }
        for (const comp of symbolImpact.components) {
          const compId = `${f.path}#${comp}`;
          builder.addNode(compId, 'COMPONENT', comp, {
            filePath: f.path,
            kind: 'component',
            exported: true,
          });
          builder.addEdge(f.path, compId, 'CHANGED_SYMBOL', `Modified UI component ${comp}`, 'HIGH');
        }
      }
    }

    // 3. ROUTE / COMPONENT Nodes & Edges
    for (const r of affectedRoutes) {
      builder.addNode(r.route, 'ROUTE', r.route);
      for (const f of changedFiles) {
        if (r.reason && (r.reason.includes(f.path) || f.path.includes(r.route.replace(/^\//, '')))) {
          builder.addEdge(f.path, r.route, 'SERVES', r.reason, r.confidence);
        }
      }
    }

    // 4. API Nodes & Edges
    for (const a of affectedApis) {
      const apiNodeId = `api:${a.method || 'ANY'}:${a.path}`;
      builder.addNode(apiNodeId, 'API', `${a.method || 'ANY'} ${a.path}`, {
        method: a.method,
        path: a.path,
      });
      for (const f of changedFiles) {
        if (a.reason && (a.reason.includes(f.path) || f.path.includes(a.path.replace(/^\//, '')))) {
          builder.addEdge(f.path, apiNodeId, 'SERVES', a.reason, a.confidence);
        }
      }
    }

    // 5. WORKFLOW Nodes & Edges
    for (const wf of affectedWorkflows) {
      const wfNodeId = `workflow:${wf.workflowId || wf.workflowName}`;
      builder.addNode(wfNodeId, 'WORKFLOW', wf.workflowName, {
        workflowId: wf.workflowId,
        criticality: wf.criticality,
      });

      // Link routes to workflows
      for (const r of affectedRoutes) {
        if (wf.reason && wf.reason.includes(r.route)) {
          builder.addEdge(r.route, wfNodeId, 'AFFECTED_WORKFLOW', wf.reason, wf.confidence);
        }
      }

      // Link APIs to workflows
      for (const a of affectedApis) {
        const apiNodeId = `api:${a.method || 'ANY'}:${a.path}`;
        if (wf.reason && wf.reason.includes(a.path)) {
          builder.addEdge(apiNodeId, wfNodeId, 'AFFECTED_WORKFLOW', wf.reason, wf.confidence);
        }
      }

      // If directly affected by file
      for (const f of changedFiles) {
        if (wf.reason && wf.reason.includes(f.path)) {
          builder.addEdge(f.path, wfNodeId, 'AFFECTED_WORKFLOW', wf.reason, wf.confidence);
        }
      }
    }

    // 6. QA TARGET Nodes (Translating Workflows & APIs into QA Targets)
    for (const wf of affectedWorkflows) {
      const wfNodeId = `workflow:${wf.workflowId || wf.workflowName}`;
      const targetNodeId = `qa_target:workflow:${wf.workflowId || wf.workflowName}`;
      builder.addNode(targetNodeId, 'QA_TARGET', `User Journey: ${wf.workflowName}`, {
        domain: 'JOURNEY',
        criticality: wf.criticality,
      });
      builder.addEdge(wfNodeId, targetNodeId, 'TESTED_BY', `Workflow exercised by journey QA`, 'HIGH');
      if (environment && environment.environmentId) {
        builder.addEdge(targetNodeId, `env:${environment.environmentId}`, 'AFFECTED_ENVIRONMENT', `Target scoped to ${environment.environmentName || environment.environmentId}`, 'HIGH');
      }
    }

    for (const a of affectedApis) {
      const apiNodeId = `api:${a.method || 'ANY'}:${a.path}`;
      const targetNodeId = `qa_target:api:${a.method || 'ANY'}:${a.path}`;
      builder.addNode(targetNodeId, 'QA_TARGET', `API Audit: ${a.method || 'ANY'} ${a.path}`, {
        domain: 'API',
        path: a.path,
      });
      builder.addEdge(apiNodeId, targetNodeId, 'TESTED_BY', `API endpoint verified by API QA`, 'HIGH');
      if (environment && environment.environmentId) {
        builder.addEdge(targetNodeId, `env:${environment.environmentId}`, 'AFFECTED_ENVIRONMENT', `Target scoped to ${environment.environmentName || environment.environmentId}`, 'HIGH');
      }
    }

    // 7. HISTORICAL FINDINGS / ISSUES Nodes & Edges
    for (const s of historicalSignals) {
      const histId = `hist:${s.targetIdentifier}`;
      const signalReason = s.metadata?.reason || `${s.signalType} on ${s.targetIdentifier}`;
      builder.addNode(histId, 'HISTORICAL_ISSUE', s.signalType, {
        target: s.targetIdentifier,
        confidence: s.confidence,
        reason: signalReason,
      });

      // Connect historical issue to corresponding target
      const matchingTargetId = Object.keys(builder.build().nodes).find(
        (id) => id.includes(s.targetIdentifier) || s.targetIdentifier.includes(id)
      );

      if (matchingTargetId) {
        const edgeRel = s.signalType === 'RECOVERED_DEFECT' ? 'RECOVERED_BEFORE' : 'FAILED_BEFORE';
        builder.addEdge(histId, matchingTargetId, edgeRel, signalReason, 'HIGH');
      }
    }

    return builder.build();
  }
}
