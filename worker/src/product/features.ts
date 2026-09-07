// ==============================================================================
// Sculra Product Feature Discovery Engine (worker/src/product/features.ts)
// ==============================================================================

import { DiscoveredPage } from '../types';
import { ProductFeature, SemanticPageClassification, CriticalityAssessment } from './types';

export class FeatureDiscoveryEngine {
  /**
   * Discovers cohesive product capabilities from classified pages and interactive structures.
   */
  public static discoverFeatures(
    pages: DiscoveredPage[],
    classifications: SemanticPageClassification[]
  ): ProductFeature[] {
    const featuresMap = new Map<string, ProductFeature>();
    const pageCategoryMap = new Map<string, SemanticPageClassification>();
    for (const c of classifications) {
      pageCategoryMap.set(c.pageUrl, c);
    }

    const addOrUpdateFeature = (
      featureKey: string,
      name: string,
      description: string,
      category: string,
      pageUrl: string,
      controlSelectors: string[],
      formSelectors: string[],
      route: string,
      evidenceItem: string,
      isCoreCapability: boolean,
      baseCriticalityScore: number
    ) => {
      const id = `feat-${featureKey}`;
      let feature = featuresMap.get(id);

      if (!feature) {
        const criticality: CriticalityAssessment = {
          score: baseCriticalityScore,
          level: baseCriticalityScore >= 80 ? 'CRITICAL' : baseCriticalityScore >= 60 ? 'HIGH' : baseCriticalityScore >= 40 ? 'MEDIUM' : 'LOW',
          reasons: [`Discovered from core ${category} routes and interactive elements.`],
          evidence: [evidenceItem],
          confidence: 0.9,
        };

        feature = {
          id,
          name,
          description,
          category,
          relatedPages: [],
          relatedControls: [],
          relatedForms: [],
          relatedRoutes: [],
          relatedWorkflowIds: [],
          confidence: 0.9,
          evidence: [evidenceItem],
          criticality,
          status: 'OBSERVED',
          isCoreCapability,
        };
        featuresMap.set(id, feature);
      } else {
        if (!feature.evidence.includes(evidenceItem)) {
          feature.evidence.push(evidenceItem);
        }
      }

      if (!feature.relatedPages.includes(pageUrl)) {
        feature.relatedPages.push(pageUrl);
      }
      if (route && !feature.relatedRoutes.includes(route)) {
        feature.relatedRoutes.push(route);
      }
      for (const ctrl of controlSelectors) {
        if (!feature.relatedControls.includes(ctrl)) {
          feature.relatedControls.push(ctrl);
        }
      }
      for (const frm of formSelectors) {
        if (!feature.relatedForms.includes(frm)) {
          feature.relatedForms.push(frm);
        }
      }
    };

    // Group pages and elements into features
    for (const page of pages) {
      const classification = pageCategoryMap.get(page.url);
      const cat = classification?.category || 'UNKNOWN';

      let pathname = '';
      try {
        pathname = new URL(page.url).pathname;
      } catch {
        pathname = page.url;
      }

      const buttonSelectors = (page.elements || [])
        .filter((e) => e.type === 'button' || e.role === 'button')
        .map((e) => e.selector);
      const formSelectors = (page.forms || []).map((f) => f.submitSelector || f.action || 'form');

      // 1. Authentication Feature
      if (cat === 'AUTH' || cat === 'LOGIN' || cat === 'SIGN_UP') {
        addOrUpdateFeature(
          'auth',
          'User Authentication & Access',
          'User login, registration, and session authentication capability.',
          'Authentication',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Authentication routes detected: ${pathname}`,
          true,
          90
        );
      }

      // 2. Dashboard & Workspace Analytics
      else if (cat === 'DASHBOARD' || cat === 'ANALYTICS' || cat === 'REPORT') {
        addOrUpdateFeature(
          'dashboard_analytics',
          'Dashboard & Workspace Insights',
          'Overview of key workspace metrics, telemetry charts, and operational summary.',
          'Analytics',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Dashboard/Analytics views on route: ${pathname}`,
          true,
          75
        );
      }

      // 3. User & Organization Settings / Profile
      else if (cat === 'SETTINGS' || cat === 'PROFILE' || cat === 'ADMIN') {
        addOrUpdateFeature(
          'settings_admin',
          'Account Settings & Administration',
          'Management of user profiles, workspace configurations, and organization permissions.',
          'Administration',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Settings and administration route: ${pathname}`,
          true,
          70
        );
      }

      // 4. Billing, Checkout & Payment
      else if (cat === 'CHECKOUT' || cat === 'PAYMENT' || cat === 'CART') {
        addOrUpdateFeature(
          'billing_payment',
          'Billing, Subscriptions & Payment',
          'Monetization, subscription checkout, payment processing, and plan management.',
          'Monetization',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Monetization/Checkout routes on route: ${pathname}`,
          true,
          95
        );
      }

      // 5. Search & Discovery
      else if (cat === 'SEARCH') {
        addOrUpdateFeature(
          'search_query',
          'Search & Information Retrieval',
          'Querying and filtering data records across the application.',
          'Discovery',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Search endpoint detected on: ${pathname}`,
          false,
          60
        );
      }

      // 6. Resource CRUD Operations (e.g. /projects, /items, /posts, /reports)
      else if (cat === 'CREATE' || cat === 'EDIT' || cat === 'LIST' || cat === 'DETAIL') {
        // Extract resource name from route segment (e.g. /projects/new -> projects)
        const segments = pathname.split('/').filter(Boolean);
        const resourceName = segments[0] || 'resource';
        const formattedResourceName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);

        addOrUpdateFeature(
          `crud_${resourceName.toLowerCase()}`,
          `${formattedResourceName} Management`,
          `Create, view, edit, and manage ${formattedResourceName.toLowerCase()} entities.`,
          'Core Workflow',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Resource management operations for ${resourceName} on ${pathname}`,
          true,
          80
        );
      }

      // 7. Support & Documentation
      else if (cat === 'HELP') {
        addOrUpdateFeature(
          'help_support',
          'Help Center & Documentation',
          'Product documentation, knowledge base guides, and customer support resources.',
          'Support',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Support/Docs route on: ${pathname}`,
          false,
          40
        );
      }

      // 8. General Public Content / Landing
      else if (cat === 'LANDING' || cat === 'CONTENT') {
        addOrUpdateFeature(
          'public_showcase',
          'Marketing & Public Showcase',
          'Public marketing pages, product showcases, and feature highlights.',
          'Marketing',
          page.url,
          buttonSelectors,
          formSelectors,
          pathname,
          `Public showcase route: ${pathname}`,
          false,
          50
        );
      }
    }

    return Array.from(featuresMap.values());
  }
}
