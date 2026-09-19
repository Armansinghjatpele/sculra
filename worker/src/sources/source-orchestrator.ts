// ==============================================================================
// Sculra Multi-Source Ingestion & Connection Intelligence Orchestrator
// (worker/src/sources/source-orchestrator.ts)
// ==============================================================================

import {
  ProjectSource,
  SourceType,
  SourceStatus,
  SourceValidationResult,
  SourceValidationOptions,
  SourceSnapshot,
  SourceHealthObservation,
  SourceChange,
  SourceCapability,
} from './types';
import { SOURCE_POLICY } from './policy';
import { SourceAdapterRegistry } from './source-registry';
import { SourceSnapshotManager } from './source-snapshot';
import { SourceHealthTracker } from './source-health';
import { SourceCache } from './source-cache';
import { SourceEventEmitter } from './source-events';
import { SourceValidationException } from './source-errors';

export interface IngestSourceInput {
  id?: string;
  projectId: string;
  organizationId?: string;
  type: SourceType;
  locator: string;
  branch?: string;
  environment?: string;
  configuration?: Record<string, any>;
  validationOptions?: SourceValidationOptions;
}

export interface IngestSourceResult {
  source: ProjectSource;
  validation: SourceValidationResult;
  snapshot: SourceSnapshot;
  change: SourceChange;
  health: SourceHealthObservation;
}

export class SourceOrchestrator {
  private static instance: SourceOrchestrator;
  private sources = new Map<string, ProjectSource>(); // sourceId -> ProjectSource
  private snapshots = new Map<string, SourceSnapshot[]>(); // sourceId -> SourceSnapshot[]

  static getInstance(): SourceOrchestrator {
    if (!this.instance) {
      this.instance = new SourceOrchestrator();
    }
    return this.instance;
  }

  /**
   * Complete 10-step unified ingestion pipeline for any project source.
   */
  async ingestSource(input: IngestSourceInput): Promise<IngestSourceResult> {
    // 1. Normalize input
    const sourceType = String(input.type).toUpperCase() as SourceType;
    const locator = input.locator ? input.locator.trim() : '';
    const environment = input.environment || 'PRODUCTION';
    const branch = input.branch || (sourceType === 'GITHUB' ? 'main' : undefined);
    const config = input.configuration || {};

    if (!locator) {
      throw new SourceValidationException('Source locator (URL, repository, or archive path) is required.');
    }

    // 2. Tenant isolation & source limits enforcement
    const existingSourcesForProject = this.getSourcesForProject(input.projectId);
    const isUpdate = existingSourcesForProject.some(
      (s) => s.id === input.id || (s.type === sourceType && s.locator === locator)
    );

    if (!isUpdate && existingSourcesForProject.length >= SOURCE_POLICY.MAX_SOURCES_PER_PROJECT) {
      throw new SourceValidationException(
        `Project ${input.projectId} has reached the maximum allowed limit of ${SOURCE_POLICY.MAX_SOURCES_PER_PROJECT} sources.`
      );
    }

    // 3. Emit SOURCE_VALIDATION_STARTED event
    await SourceEventEmitter.emitValidationStarted(
      input.projectId,
      sourceType,
      locator,
      input.organizationId
    );

    // 4. Validate locator & security policy
    const adapter = SourceAdapterRegistry.getAdapter(sourceType);
    let validation: SourceValidationResult;
    try {
      validation = await adapter.validate(locator, config, input.validationOptions);
    } catch (err: any) {
      const errorMsg = err.message || 'Validation error encountered';
      await SourceEventEmitter.emitValidationFailed(
        input.projectId,
        sourceType,
        locator,
        errorMsg,
        input.organizationId
      );
      throw err;
    }

    // Check if fatal validation error occurred
    const fatalError = validation.errors.find((e) => e.fatal);
    if (fatalError) {
      await SourceEventEmitter.emitValidationFailed(
        input.projectId,
        sourceType,
        locator,
        fatalError.message,
        input.organizationId
      );
      throw new SourceValidationException(fatalError.message);
    }

    // 5. Check connectivity & resolve truthful capabilities
    const sourceId = input.id || `src-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const source: ProjectSource = {
      id: sourceId,
      projectId: input.projectId,
      organizationId: input.organizationId,
      type: sourceType,
      locator,
      branch,
      environment,
      status: validation.status,
      configuration: config,
      capabilities: validation.capabilities,
      createdAt: now,
      updatedAt: now,
    };

    // Store in internal registry
    this.sources.set(sourceId, source);

    // 6. Emit SOURCE_VALIDATED
    await SourceEventEmitter.emitValidated(
      source.projectId,
      source.id,
      source.type,
      validation,
      source.organizationId
    );

    // 7. Create immutable snapshot
    const snapshot = SourceSnapshotManager.createSnapshot(source, validation);
    const existingSnapshots = this.snapshots.get(sourceId) || [];
    const previousSnapshot = existingSnapshots[0];
    existingSnapshots.unshift(snapshot);
    this.snapshots.set(sourceId, existingSnapshots);

    await SourceEventEmitter.emitSnapshotCreated(source, snapshot);

    // 8. Deterministic fingerprint change detection
    const change = SourceSnapshotManager.detectSnapshotChange(previousSnapshot, snapshot);
    await SourceEventEmitter.emitSourceChange(source, change);

    // 9. Record initial health observation
    const initialHealth: SourceHealthObservation = {
      id: `hlth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      projectSourceId: source.id,
      status: validation.health,
      latencyMs: validation.latencyMs,
      metadata: {
        errorsCount: validation.errors.length,
        warningsCount: validation.warnings.length,
      },
      observedAt: now,
    };
    SourceHealthTracker.recordObservation(source.id, initialHealth);

    // 10. Emit SOURCE_CONNECTED
    await SourceEventEmitter.emitSourceConnected(source);

    // Update cache
    SourceCache.set(source.projectId, source.type, source.locator, validation);

    return {
      source,
      validation,
      snapshot,
      change,
      health: initialHealth,
    };
  }

  /**
   * Preflight validation without creating a permanent source.
   */
  async validateSource(
    type: SourceType,
    locator: string,
    config: Record<string, any> = {},
    options?: SourceValidationOptions
  ): Promise<SourceValidationResult> {
    const adapter = SourceAdapterRegistry.getAdapter(type);
    return adapter.validate(locator, config, options);
  }

  /**
   * Executes a real-time health check on an existing source.
   */
  async checkHealth(sourceId: string): Promise<SourceHealthObservation> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new SourceValidationException(`Source ${sourceId} not found.`);
    }

    return SourceHealthTracker.executeHealthCheck(source);
  }

  /**
   * Resolves truthful capabilities for a source.
   */
  async getCapabilities(sourceId: string): Promise<SourceCapability[]> {
    const source = this.sources.get(sourceId);
    if (!source) {
      throw new SourceValidationException(`Source ${sourceId} not found.`);
    }

    const adapter = SourceAdapterRegistry.getAdapter(source.type);
    return adapter.capabilities(source);
  }

  /**
   * Retrieves sources filtered by project (ensuring tenant isolation).
   */
  getSourcesForProject(projectId: string): ProjectSource[] {
    return Array.from(this.sources.values()).filter((s) => s.projectId === projectId);
  }

  /**
   * Retrieves a single source by ID.
   */
  getSource(sourceId: string): ProjectSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * Retrieves snapshots for a source.
   */
  getSnapshots(sourceId: string): SourceSnapshot[] {
    return this.snapshots.get(sourceId) || [];
  }

  /**
   * Resets orchestrator state (for testing).
   */
  reset(): void {
    this.sources.clear();
    this.snapshots.clear();
    SourceHealthTracker.clear();
    SourceCache.clear();
  }
}
