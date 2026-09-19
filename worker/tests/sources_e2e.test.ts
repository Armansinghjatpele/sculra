// ==============================================================================
// Sculra Multi-Source Ingestion & Connection Intelligence E2E Tests
// (worker/tests/sources_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SourceOrchestrator,
  SourceValidationException,
  AutonomousCampaignPlanner,
  SourceCapabilityResolver,
  ProjectSource,
  CampaignConfig,
  AutonomousEventStore,
} from '../src';

describe('Multi-Source Ingestion & Connection Intelligence E2E', () => {
  const orchestrator = SourceOrchestrator.getInstance();

  beforeEach(() => {
    orchestrator.reset();
  });

  describe('1. 10-Step Ingestion Pipeline', () => {
    it('successfully ingests a website source and generates snapshot, health, and events', async () => {
      const result = await orchestrator.ingestSource({
        projectId: 'proj-e2e-1',
        organizationId: 'org-e2e-1',
        type: 'WEBSITE',
        locator: 'https://demo.sculra.com',
        environment: 'STAGING',
        validationOptions: { skipNetworkChecks: true },
      });

      expect(result.source).toBeDefined();
      expect(result.source.projectId).toBe('proj-e2e-1');
      expect(result.source.type).toBe('WEBSITE');
      expect(result.source.status).toBe('AVAILABLE');
      expect(result.source.capabilities.length).toBeGreaterThan(0);

      // Snapshot validation
      expect(result.snapshot).toBeDefined();
      expect(result.snapshot.projectId).toBe('proj-e2e-1');
      expect(result.snapshot.fingerprint).toBeDefined();

      // Change validation: First observation is SOURCE_CONNECTED
      expect(result.change.type).toBe('SOURCE_CONNECTED');

      // Health validation
      expect(result.health.status).toBe('HEALTHY');

      // Stored in orchestrator
      const projectSources = orchestrator.getSourcesForProject('proj-e2e-1');
      expect(projectSources.length).toBe(1);
      expect(projectSources[0].locator).toBe('https://demo.sculra.com');
    });

    it('detects SOURCE_UNCHANGED on duplicate ingestion of unchanged source', async () => {
      // First ingestion
      await orchestrator.ingestSource({
        id: 'src-static-1',
        projectId: 'proj-e2e-2',
        type: 'WEBSITE',
        locator: 'https://app.sculra.com',
        validationOptions: { skipNetworkChecks: true },
      });

      // Second ingestion of same source
      const res2 = await orchestrator.ingestSource({
        id: 'src-static-1',
        projectId: 'proj-e2e-2',
        type: 'WEBSITE',
        locator: 'https://app.sculra.com',
        validationOptions: { skipNetworkChecks: true },
      });

      expect(res2.change.type).toBe('SOURCE_UNCHANGED');
    });

    it('enforces maximum 10 sources per project ceiling', async () => {
      const projectId = 'proj-bounded-sources';

      // Ingest 10 sources
      for (let i = 1; i <= 10; i++) {
        await orchestrator.ingestSource({
          projectId,
          type: 'WEBSITE',
          locator: `https://sub${i}.example.com`,
          validationOptions: { skipNetworkChecks: true },
        });
      }

      const sources = orchestrator.getSourcesForProject(projectId);
      expect(sources.length).toBe(10);

      // 11th source must be rejected
      await expect(
        orchestrator.ingestSource({
          projectId,
          type: 'WEBSITE',
          locator: 'https://sub11.example.com',
          validationOptions: { skipNetworkChecks: true },
        })
      ).rejects.toThrow(/maximum allowed limit of 10 sources/);
    });

    it('maintains strict multi-tenant source isolation', async () => {
      await orchestrator.ingestSource({
        projectId: 'proj-tenant-alpha',
        type: 'WEBSITE',
        locator: 'https://alpha.internal.io',
        validationOptions: { skipNetworkChecks: true },
      });

      await orchestrator.ingestSource({
        projectId: 'proj-tenant-beta',
        type: 'WEBSITE',
        locator: 'https://beta.internal.io',
        validationOptions: { skipNetworkChecks: true },
      });

      const alphaSources = orchestrator.getSourcesForProject('proj-tenant-alpha');
      const betaSources = orchestrator.getSourcesForProject('proj-tenant-beta');

      expect(alphaSources.length).toBe(1);
      expect(alphaSources[0].locator).toBe('https://alpha.internal.io');

      expect(betaSources.length).toBe(1);
      expect(betaSources[0].locator).toBe('https://beta.internal.io');
    });
  });

  describe('2. Downstream Campaign Planner Capability-Aware Skipping', () => {
    it('schedules full suite as QUEUED when all browser capabilities are AVAILABLE (WEBSITE)', () => {
      const websiteSource: ProjectSource = {
        id: 'src-web-full',
        projectId: 'proj-camp-1',
        type: 'WEBSITE',
        locator: 'https://example.com',
        environment: 'PRODUCTION',
        status: 'AVAILABLE',
        configuration: {},
        capabilities: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const caps = SourceCapabilityResolver.resolveTruthfulCapabilities(websiteSource);

      const config: CampaignConfig = {
        objective: 'full_suite',
        domains: ['DISCOVERY', 'FUNCTIONAL', 'ACCESSIBILITY', 'VISUAL', 'PERFORMANCE', 'RELEASE'],
        capabilities: caps,
      };

      const tasks = AutonomousCampaignPlanner.planCampaign(
        'camp-1',
        'https://example.com',
        config,
        []
      );

      // Discovery task should be QUEUED (browser available)
      const discoveryTask = tasks.find((t) => t.taskType === 'APPLICATION_DISCOVERY');
      expect(discoveryTask).toBeDefined();
      expect(discoveryTask?.status).toBe('QUEUED');
      expect(discoveryTask?.skipReason).toBeUndefined();

      // Accessibility task should be QUEUED
      const a11yTask = tasks.find((t) => t.taskType === 'ACCESSIBILITY_AUDIT');
      expect(a11yTask).toBeDefined();
      expect(a11yTask?.status).toBe('QUEUED');
    });

    it('gracefully sets tasks to SKIPPED with UNSUPPORTED_SURFACE when browser caps are UNAVAILABLE (GITHUB / ZIP / DESKTOP)', () => {
      const githubSource: ProjectSource = {
        id: 'src-gh-codeonly',
        projectId: 'proj-camp-2',
        type: 'GITHUB',
        locator: 'org/repo',
        environment: 'PRODUCTION',
        status: 'AVAILABLE',
        configuration: {},
        capabilities: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // GITHUB capabilities have BROWSER_NAVIGATION = UNAVAILABLE
      const caps = SourceCapabilityResolver.resolveTruthfulCapabilities(githubSource);

      const config: CampaignConfig = {
        objective: 'full_suite',
        domains: ['DISCOVERY', 'FUNCTIONAL', 'ACCESSIBILITY', 'VISUAL', 'PERFORMANCE', 'RELEASE'],
        capabilities: caps,
      };

      const tasks = AutonomousCampaignPlanner.planCampaign(
        'camp-2',
        'https://example.com',
        config,
        []
      );

      // Browser-dependent tasks must be truthfully SKIPPED
      const discoveryTask = tasks.find((t) => t.taskType === 'APPLICATION_DISCOVERY');
      expect(discoveryTask).toBeDefined();
      expect(discoveryTask?.status).toBe('SKIPPED');
      expect(discoveryTask?.skipReason).toBe('UNSUPPORTED_SURFACE');
      expect(discoveryTask?.reason).toContain('DOM/browser navigation capability unavailable');

      const journeyTask = tasks.find((t) => t.taskType === 'USER_JOURNEY_EXECUTION');
      expect(journeyTask).toBeDefined();
      expect(journeyTask?.status).toBe('SKIPPED');
      expect(journeyTask?.skipReason).toBe('UNSUPPORTED_SURFACE');

      const a11yTask = tasks.find((t) => t.taskType === 'ACCESSIBILITY_AUDIT');
      expect(a11yTask).toBeDefined();
      expect(a11yTask?.status).toBe('SKIPPED');
      expect(a11yTask?.skipReason).toBe('UNSUPPORTED_SURFACE');

      const visualTask = tasks.find((t) => t.taskType === 'VISUAL_RESPONSIVE_AUDIT');
      expect(visualTask).toBeDefined();
      expect(visualTask?.status).toBe('SKIPPED');
      expect(visualTask?.skipReason).toBe('UNSUPPORTED_SURFACE');

      const perfTask = tasks.find((t) => t.taskType === 'PERFORMANCE_AUDIT');
      expect(perfTask).toBeDefined();
      expect(perfTask?.status).toBe('SKIPPED');
      expect(perfTask?.skipReason).toBe('UNSUPPORTED_SURFACE');

      // Non-browser-dependent release task remains scheduled
      const releaseTask = tasks.find((t) => t.taskType === 'RELEASE_READINESS_EVALUATION');
      expect(releaseTask).toBeDefined();
      expect(releaseTask?.status).toBe('QUEUED');
    });

    it('truthfully skips API tasks when API capability is UNAVAILABLE', () => {
      // Create capabilities where API_TESTING is UNAVAILABLE
      const caps = SourceCapabilityResolver.resolveTruthfulCapabilities({
        id: 'src-zip-test',
        projectId: 'p1',
        type: 'ZIP',
        locator: 'bundle.zip',
        environment: 'TEST',
        status: 'NOT_READY',
        configuration: {},
        capabilities: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const config: CampaignConfig = {
        objective: 'custom',
        domains: ['API'],
        capabilities: caps,
      };

      const tasks = AutonomousCampaignPlanner.planCampaign(
        'camp-api-skip',
        'https://api.example.com',
        config,
        []
      );

      const apiTask = tasks.find((t) => t.domain === 'API');
      expect(apiTask).toBeDefined();
      expect(apiTask?.status).toBe('SKIPPED');
      expect(apiTask?.skipReason).toBe('UNSUPPORTED_SURFACE');
      expect(apiTask?.reason).toContain('API testing capability unavailable');
    });
  });
});
