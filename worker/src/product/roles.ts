// ==============================================================================
// Sculra User Role Discovery Engine (worker/src/product/roles.ts)
// ==============================================================================

import { DiscoveredPage } from '../types';
import { ProductRole, SemanticPageClassification, ProductFeature } from './types';

export class RoleDiscoveryEngine {
  /**
   * Discovers plausible user roles strictly grounded in observed routes and controls.
   */
  public static discoverRoles(
    pages: DiscoveredPage[],
    classifications: SemanticPageClassification[],
    features: ProductFeature[]
  ): ProductRole[] {
    const rolesMap = new Map<string, ProductRole>();

    const addRole = (
      roleKey: string,
      name: string,
      confidence: number,
      evidenceItem: string,
      capability: string,
      status: 'OBSERVED' | 'INFERRED' | 'HYPOTHESIZED'
    ) => {
      const id = `role-${roleKey.toLowerCase()}`;
      let role = rolesMap.get(id);

      if (!role) {
        role = {
          id,
          name,
          confidence,
          evidence: [evidenceItem],
          observedCapabilities: [capability],
          relatedFeatureIds: [],
          relatedWorkflowIds: [],
          status,
        };
        rolesMap.set(id, role);
      } else {
        if (!role.evidence.includes(evidenceItem)) {
          role.evidence.push(evidenceItem);
        }
        if (!role.observedCapabilities.includes(capability)) {
          role.observedCapabilities.push(capability);
        }
        role.confidence = Math.max(role.confidence, confidence);
      }

      // Link related features
      for (const feat of features) {
        if (
          (roleKey === 'visitor' && (feat.category === 'Marketing' || feat.category === 'Authentication')) ||
          (roleKey === 'admin' && (feat.category === 'Administration' || feat.id.includes('admin'))) ||
          (roleKey === 'member' && (feat.category === 'Core Workflow' || feat.category === 'Analytics')) ||
          (roleKey === 'customer' && (feat.category === 'Monetization' || feat.category === 'Discovery'))
        ) {
          if (!role.relatedFeatureIds.includes(feat.id)) {
            role.relatedFeatureIds.push(feat.id);
          }
        }
      }
    };

    // 1. Visitor Role (Always inferred if public landing or auth routes exist)
    const hasLanding = classifications.some((c) => c.category === 'LANDING' || c.category === 'SIGN_UP' || c.category === 'LOGIN');
    if (hasLanding) {
      addRole(
        'visitor',
        'Visitor / Unauthenticated User',
        0.95,
        'Public marketing, documentation, or authentication entry routes discovered.',
        'Can browse public showcase, review documentation, and initiate sign-up/login.',
        'OBSERVED'
      );
    }

    // 2. Authenticated Member / User Role
    const hasAuthenticatedAreas = classifications.some(
      (c) => c.category === 'DASHBOARD' || c.category === 'CREATE' || c.category === 'EDIT' || c.category === 'SETTINGS'
    );
    if (hasAuthenticatedAreas) {
      addRole(
        'member',
        'Authenticated Member / User',
        0.9,
        'Authenticated dashboard, workspace resource creation, or settings routes discovered.',
        'Can view dashboard metrics, execute CRUD operations, and modify account settings.',
        'INFERRED'
      );
    }

    // 3. Administrator / Workspace Manager Role
    const hasAdminSignals = pages.some((p) => {
      const pUrl = (p.url || '').toLowerCase();
      const pTitle = (p.title || '').toLowerCase();
      const buttons = (p.elements || []).map((e) => (e.text || '').toLowerCase()).join(' ');
      return (
        pUrl.includes('/admin') ||
        pUrl.includes('/organization') ||
        pUrl.includes('/team') ||
        pTitle.includes('admin') ||
        pTitle.includes('team management') ||
        buttons.includes('invite') ||
        buttons.includes('permissions') ||
        buttons.includes('manage members')
      );
    });

    if (hasAdminSignals) {
      addRole(
        'admin',
        'Workspace Administrator',
        0.88,
        'Admin routes, organization controls, or user invitation mechanisms observed.',
        'Can manage workspace members, configure permissions, and administer organization settings.',
        'OBSERVED'
      );
    }

    // 4. Customer / Buyer Role (for e-commerce or monetization workflows)
    const hasCommerceSignals = classifications.some(
      (c) => c.category === 'CHECKOUT' || c.category === 'PAYMENT' || c.category === 'CART'
    );
    if (hasCommerceSignals) {
      addRole(
        'customer',
        'Customer / Subscriber',
        0.85,
        'Shopping cart, subscription billing, or checkout routes detected.',
        'Can select product plans, manage subscriptions, and process checkout transactions.',
        'INFERRED'
      );
    }

    return Array.from(rolesMap.values());
  }
}
