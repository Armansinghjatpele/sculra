// ==============================================================================
// Sculra Environment Entity Management (worker/src/release/environment.ts)
// ==============================================================================

import { ProjectEnvironment, EnvironmentType, EnvironmentStatus, EnvironmentHealthStatus } from './types';
import { EnvironmentValidator } from './environment-validator';

export class EnvironmentManager {
  /**
   * Generates a URL-safe unique slug for an environment name within a project.
   */
  public static generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'env';
  }

  public static createEnvironment(params: {
    id?: string;
    organizationId?: string | null;
    projectId: string;
    name: string;
    slug?: string;
    type: EnvironmentType;
    baseUrl: string;
    branch?: string | null;
    commitSha?: string | null;
    isProduction?: boolean;
    metadata?: Record<string, any>;
  }): ProjectEnvironment {
    const slug = params.slug || this.generateSlug(params.name);
    const now = new Date().toISOString();
    return {
      id: params.id || `env-${Date.now()}`,
      organizationId: params.organizationId || null,
      projectId: params.projectId,
      name: params.name,
      slug,
      type: params.type,
      baseUrl: params.baseUrl,
      branch: params.branch || null,
      commitSha: params.commitSha || null,
      status: 'ACTIVE',
      isProduction: params.isProduction ?? (params.type === 'PRODUCTION'),
      healthStatus: 'HEALTHY',
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Validates and normalizes an environment configuration before persistence.
   */
  public static async createEnvironmentDraft(params: {
    projectId: string;
    organizationId?: string | null;
    sourceId?: string | null;
    name: string;
    slug?: string;
    type: EnvironmentType;
    baseUrl: string;
    branch?: string | null;
    commitSha?: string | null;
    isProduction?: boolean;
    metadata?: Record<string, any>;
    allowLocalhost?: boolean;
  }): Promise<{ environment: Omit<ProjectEnvironment, 'id' | 'createdAt' | 'updatedAt'>; validationError?: string }> {
    const isProduction = params.isProduction ?? (params.type === 'PRODUCTION');
    const slug = params.slug || this.generateSlug(params.name);

    // Run SSRF and connectivity validation
    const validation = await EnvironmentValidator.validateEnvironmentUrl(params.baseUrl, {
      allowLocalhost: params.allowLocalhost,
    });

    let status: EnvironmentStatus = 'ACTIVE';
    if (!validation.valid) {
      if (validation.healthStatus === 'MISCONFIGURED') {
        status = 'MISCONFIGURED';
      } else if (validation.healthStatus === 'AUTH_REQUIRED') {
        status = 'AUTH_REQUIRED';
      } else {
        status = 'UNREACHABLE';
      }
    }

    const environment: Omit<ProjectEnvironment, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId: params.projectId,
      organizationId: params.organizationId || null,
      sourceId: params.sourceId || null,
      name: params.name.trim(),
      slug,
      type: params.type,
      baseUrl: params.baseUrl.trim(),
      branch: params.branch || null,
      commitSha: params.commitSha || null,
      status,
      isProduction,
      healthStatus: validation.healthStatus,
      lastHealthCheckAt: validation.checkedAt,
      metadata: {
        ...(params.metadata || {}),
        lastValidationLatencyMs: validation.latencyMs,
        lastValidationHttpStatus: validation.httpStatus,
      },
    };

    return {
      environment,
      validationError: validation.valid ? undefined : validation.error,
    };
  }
}
