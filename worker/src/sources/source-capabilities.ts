// ==============================================================================
// Sculra Truthful Source Capability Resolver (worker/src/sources/source-capabilities.ts)
// ==============================================================================

import {
  SourceType,
  SourceCapability,
  SourceStatus,
  SourceHealthState,
  CapabilityState,
  SourceCapabilityKey,
} from './types';

export class SourceCapabilityResolver {
  /**
   * Resolves truthful runtime capabilities based on source type, health state, and configuration.
   */
  static resolveTruthfulCapabilities(
    source: { type: SourceType; status: SourceStatus; configuration?: Record<string, any> },
    health: SourceHealthState = 'HEALTHY'
  ): SourceCapability[] {
    return this.resolve(source.type, health, source.status, source.configuration);
  }

  /**
   * Resolves truthful runtime capabilities based on source type, health state, and configuration.
   */
  static resolve(
    sourceType: SourceType,
    health: SourceHealthState,
    status: SourceStatus,
    config?: Record<string, any>
  ): SourceCapability[] {
    const isHealthy = health === 'HEALTHY' || health === 'DEGRADED';
    const isAvailable = status === 'AVAILABLE' && isHealthy;

    const capabilities: SourceCapability[] = [];

    // Helper to register capability
    const addCap = (key: SourceCapabilityKey, state: CapabilityState, reason?: string) => {
      capabilities.push({ key, state, reason });
    };

    switch (sourceType) {
      case 'WEBSITE': {
        const browserState: CapabilityState = isAvailable
          ? health === 'DEGRADED'
            ? 'PARTIAL'
            : 'AVAILABLE'
          : 'UNAVAILABLE';

        const reason = !isAvailable
          ? `Website source is ${health.toLowerCase()} (${status.toLowerCase()}). Browser execution unavailable.`
          : undefined;

        // Browser & UX capabilities
        addCap('BROWSER_NAVIGATION', browserState, reason);
        addCap('DOM_DISCOVERY', browserState, reason);
        addCap('FUNCTIONAL_TESTING', browserState, reason);
        addCap('VISUAL_TESTING', browserState, reason);
        addCap('RESPONSIVE_TESTING', browserState, reason);
        addCap('ACCESSIBILITY_TESTING', browserState, reason);
        addCap('PERFORMANCE_TESTING', browserState, reason);
        addCap('BROWSER_NETWORK_OBSERVATION', browserState, reason);

        // Repo / Code capabilities are UNAVAILABLE on live website
        addCap('REPOSITORY_ANALYSIS', 'UNAVAILABLE', 'Requires GITHUB or code repository source connection.');
        addCap('CHANGE_DETECTION', 'UNAVAILABLE', 'Repository commit change detection requires GITHUB source.');
        addCap('SOURCE_MAPPING', 'UNAVAILABLE', 'Direct code source mapping requires repository access.');
        addCap('RCA_CONTEXT', 'UNAVAILABLE', 'Code-level root-cause analysis requires GITHUB source.');
        addCap('REMEDIATION_CONTEXT', 'UNAVAILABLE', 'Automated patch generation requires GITHUB source.');
        addCap('CI_CONTEXT', 'UNAVAILABLE', 'CI webhook integration requires repository connection.');
        addCap('API_TESTING', 'UNAVAILABLE', 'Requires dedicated API source connection or OpenAPI schema.');
        addCap('DESKTOP_TESTING', 'UNAVAILABLE', 'Requires DESKTOP source connection.');
        addCap('SOURCE_ANALYSIS', 'UNAVAILABLE', 'Static code analysis requires repository or archive source.');
        break;
      }

      case 'GITHUB': {
        const gitState: CapabilityState = isAvailable ? 'AVAILABLE' : 'UNAVAILABLE';
        const reason = !isAvailable
          ? `GitHub repository is ${health.toLowerCase()}. Code analysis context unavailable.`
          : undefined;

        // Code and repository capabilities
        addCap('REPOSITORY_ANALYSIS', gitState, reason);
        addCap('CHANGE_DETECTION', gitState, reason);
        addCap('SOURCE_MAPPING', gitState, reason);
        addCap('RCA_CONTEXT', gitState, reason);
        addCap('REMEDIATION_CONTEXT', gitState, reason);
        addCap('CI_CONTEXT', gitState, reason);
        addCap('SOURCE_ANALYSIS', gitState, reason);

        // Live browser / UX capabilities are UNAVAILABLE for code-only GITHUB source
        addCap('BROWSER_NAVIGATION', 'UNAVAILABLE', 'Live browser execution requires WEBSITE source or deployed staging URL.');
        addCap('DOM_DISCOVERY', 'UNAVAILABLE', 'DOM discovery requires live deployed WEBSITE source.');
        addCap('FUNCTIONAL_TESTING', 'UNAVAILABLE', 'Functional UI testing requires live deployed WEBSITE source.');
        addCap('VISUAL_TESTING', 'UNAVAILABLE', 'Visual screenshot capture requires live deployed WEBSITE source.');
        addCap('RESPONSIVE_TESTING', 'UNAVAILABLE', 'Responsive viewport auditing requires live deployed WEBSITE source.');
        addCap('ACCESSIBILITY_TESTING', 'UNAVAILABLE', 'Accessibility auditing requires live deployed WEBSITE source.');
        addCap('PERFORMANCE_TESTING', 'UNAVAILABLE', 'Core Web Vitals benchmarking requires live deployed WEBSITE source.');
        addCap('BROWSER_NETWORK_OBSERVATION', 'UNAVAILABLE', 'Browser network monitoring requires live deployed WEBSITE source.');
        addCap('API_TESTING', 'UNAVAILABLE', 'Requires API source connection.');
        addCap('DESKTOP_TESTING', 'UNAVAILABLE', 'Requires DESKTOP source connection.');
        break;
      }

      case 'API': {
        const hasOpenApi = Boolean(config?.openApiUrl || config?.openApiDocument);
        const apiState: CapabilityState = isAvailable
          ? hasOpenApi
            ? 'AVAILABLE'
            : 'PARTIAL'
          : 'UNAVAILABLE';

        const apiReason = !isAvailable
          ? `API endpoint is ${health.toLowerCase()}.`
          : !hasOpenApi
          ? 'Endpoint configured without OpenAPI schema; automated discovery limited to probed routes.'
          : undefined;

        addCap('API_TESTING', apiState, apiReason);
        addCap('BROWSER_NAVIGATION', 'UNAVAILABLE', 'Live browser navigation unavailable for API source.');
        addCap('DOM_DISCOVERY', 'UNAVAILABLE', 'DOM discovery unavailable for API source.');
        addCap('FUNCTIONAL_TESTING', 'UNAVAILABLE', 'Functional UI testing unavailable for API source.');
        addCap('VISUAL_TESTING', 'UNAVAILABLE', 'Visual testing unavailable for API source.');
        addCap('RESPONSIVE_TESTING', 'UNAVAILABLE', 'Responsive viewport auditing unavailable for API source.');
        addCap('ACCESSIBILITY_TESTING', 'UNAVAILABLE', 'Accessibility auditing unavailable for API source.');
        addCap('PERFORMANCE_TESTING', 'PARTIAL', 'API response latency profiling available.');
        addCap('BROWSER_NETWORK_OBSERVATION', 'UNAVAILABLE', 'Browser network observation unavailable for API source.');
        addCap('REPOSITORY_ANALYSIS', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('CHANGE_DETECTION', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('SOURCE_MAPPING', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('RCA_CONTEXT', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('REMEDIATION_CONTEXT', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('CI_CONTEXT', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('DESKTOP_TESTING', 'UNAVAILABLE', 'Requires DESKTOP source.');
        addCap('SOURCE_ANALYSIS', 'UNAVAILABLE', 'Requires code repository or archive source.');
        break;
      }

      case 'ZIP': {
        const hasArchive = Boolean(config?.archiveUrl || config?.extractedPath);
        addCap(
          'SOURCE_ANALYSIS',
          hasArchive ? 'PARTIAL' : 'UNAVAILABLE',
          hasArchive
            ? 'ZIP archive available for static analysis. Live browser execution unavailable.'
            : 'ZIP archive upload storage not provisioned. Source is not ready for testing.'
        );
        addCap('BROWSER_NAVIGATION', 'UNAVAILABLE', 'Live browser execution unavailable for ZIP archive source.');
        addCap('DOM_DISCOVERY', 'UNAVAILABLE', 'DOM discovery unavailable for ZIP archive source.');
        addCap('FUNCTIONAL_TESTING', 'UNAVAILABLE', 'Functional UI testing unavailable for ZIP archive source.');
        addCap('VISUAL_TESTING', 'UNAVAILABLE', 'Visual testing unavailable for ZIP archive source.');
        addCap('RESPONSIVE_TESTING', 'UNAVAILABLE', 'Responsive viewport testing unavailable for ZIP archive source.');
        addCap('ACCESSIBILITY_TESTING', 'UNAVAILABLE', 'Accessibility testing unavailable for ZIP archive source.');
        addCap('PERFORMANCE_TESTING', 'UNAVAILABLE', 'Performance benchmarking unavailable for ZIP archive source.');
        addCap('BROWSER_NETWORK_OBSERVATION', 'UNAVAILABLE', 'Browser network observation unavailable for ZIP archive source.');
        addCap('REPOSITORY_ANALYSIS', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('CHANGE_DETECTION', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('SOURCE_MAPPING', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('RCA_CONTEXT', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('REMEDIATION_CONTEXT', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('CI_CONTEXT', 'UNAVAILABLE', 'Requires GITHUB source.');
        addCap('API_TESTING', 'UNAVAILABLE', 'Requires API source.');
        addCap('DESKTOP_TESTING', 'UNAVAILABLE', 'Requires DESKTOP source.');
        break;
      }

      case 'DESKTOP': {
        const deskReason = 'Desktop agent worker infrastructure not provisioned. Execution blocked by safety policy.';
        addCap('DESKTOP_TESTING', 'UNAVAILABLE', deskReason);
        addCap('BROWSER_NAVIGATION', 'UNAVAILABLE', deskReason);
        addCap('DOM_DISCOVERY', 'UNAVAILABLE', deskReason);
        addCap('FUNCTIONAL_TESTING', 'UNAVAILABLE', deskReason);
        addCap('VISUAL_TESTING', 'UNAVAILABLE', deskReason);
        addCap('RESPONSIVE_TESTING', 'UNAVAILABLE', deskReason);
        addCap('ACCESSIBILITY_TESTING', 'UNAVAILABLE', deskReason);
        addCap('PERFORMANCE_TESTING', 'UNAVAILABLE', deskReason);
        addCap('BROWSER_NETWORK_OBSERVATION', 'UNAVAILABLE', deskReason);
        addCap('REPOSITORY_ANALYSIS', 'UNAVAILABLE', deskReason);
        addCap('CHANGE_DETECTION', 'UNAVAILABLE', deskReason);
        addCap('SOURCE_MAPPING', 'UNAVAILABLE', deskReason);
        addCap('RCA_CONTEXT', 'UNAVAILABLE', deskReason);
        addCap('REMEDIATION_CONTEXT', 'UNAVAILABLE', deskReason);
        addCap('CI_CONTEXT', 'UNAVAILABLE', deskReason);
        addCap('API_TESTING', 'UNAVAILABLE', deskReason);
        addCap('SOURCE_ANALYSIS', 'UNAVAILABLE', deskReason);
        break;
      }
    }

    return capabilities;
  }
}
