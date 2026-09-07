// ==============================================================================
// Sculra Product Model & Discovery Unit Tests (worker/tests/product_model.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { SemanticPageClassifier } from '../src/product/classifier';
import { FeatureDiscoveryEngine } from '../src/product/features';
import { RoleDiscoveryEngine } from '../src/product/roles';
import { WorkflowDiscoveryEngine } from '../src/product/workflows';
import { ProductModelBuilder } from '../src/product/model';
import { ProductGraph } from '../src/product/graph';
import { DiscoveredPage, ApplicationMap } from '../src/types';

describe('Product Understanding & Model Discovery', () => {
  const mockPages: DiscoveredPage[] = [
    {
      url: 'http://127.0.0.1:3000/',
      title: 'Acme SaaS — Modern Workflow Platform',
      depth: 0,
      elementsCount: 5,
      elements: [
        { type: 'button', tagName: 'button', text: 'Get Started Free', selector: 'button.cta', sourcePage: 'http://127.0.0.1:3000/' },
        { type: 'link', tagName: 'a', text: 'Sign In', href: 'http://127.0.0.1:3000/login', selector: 'a[href="/login"]', sourcePage: 'http://127.0.0.1:3000/' },
      ],
      forms: [],
      links: [{ text: 'Sign In', href: 'http://127.0.0.1:3000/login', isInternal: true, sourcePage: 'http://127.0.0.1:3000/' }],
      consoleErrors: [],
      networkErrors: [],
      timestamp: new Date().toISOString(),
    },
    {
      url: 'http://127.0.0.1:3000/login',
      title: 'Sign In — Acme SaaS',
      depth: 1,
      elementsCount: 3,
      elements: [
        { type: 'button', tagName: 'button', text: 'Sign In', selector: 'button[type="submit"]', sourcePage: 'http://127.0.0.1:3000/login' },
      ],
      forms: [
        {
          action: '/api/login',
          method: 'POST',
          submitSelector: 'button[type="submit"]',
          sourcePage: 'http://127.0.0.1:3000/login',
          fields: [
            { name: 'email', type: 'email', required: true, selector: 'input[name="email"]' },
            { name: 'password', type: 'password', required: true, selector: 'input[name="password"]' },
          ],
        },
      ],
      links: [],
      consoleErrors: [],
      networkErrors: [],
      timestamp: new Date().toISOString(),
    },
    {
      url: 'http://127.0.0.1:3000/dashboard',
      title: 'Dashboard — Acme SaaS',
      depth: 1,
      elementsCount: 10,
      elements: [
        { type: 'button', tagName: 'button', text: 'New Project', selector: 'button#create-proj', sourcePage: 'http://127.0.0.1:3000/dashboard' },
      ],
      forms: [],
      links: [
        { text: 'Projects', href: 'http://127.0.0.1:3000/projects', isInternal: true, sourcePage: 'http://127.0.0.1:3000/dashboard' },
        { text: 'Billing', href: 'http://127.0.0.1:3000/billing', isInternal: true, sourcePage: 'http://127.0.0.1:3000/dashboard' },
        { text: 'Admin', href: 'http://127.0.0.1:3000/admin', isInternal: true, sourcePage: 'http://127.0.0.1:3000/dashboard' },
      ],
      consoleErrors: [],
      networkErrors: [],
      timestamp: new Date().toISOString(),
    },
    {
      url: 'http://127.0.0.1:3000/projects/new',
      title: 'Create New Project — Acme SaaS',
      depth: 2,
      elementsCount: 6,
      elements: [
        { type: 'button', tagName: 'button', text: 'Create Project', selector: 'button[type="submit"]', sourcePage: 'http://127.0.0.1:3000/projects/new' },
      ],
      forms: [
        {
          action: '/api/projects',
          method: 'POST',
          submitSelector: 'button[type="submit"]',
          sourcePage: 'http://127.0.0.1:3000/projects/new',
          fields: [
            { name: 'projectName', type: 'text', required: true, selector: 'input[name="projectName"]' },
            { name: 'description', type: 'text', required: false, selector: 'textarea[name="description"]' },
          ],
        },
      ],
      links: [],
      consoleErrors: [],
      networkErrors: [],
      timestamp: new Date().toISOString(),
    },
    {
      url: 'http://127.0.0.1:3000/billing',
      title: 'Subscription & Billing — Acme SaaS',
      depth: 1,
      elementsCount: 4,
      elements: [
        { type: 'button', tagName: 'button', text: 'Upgrade to Pro', selector: 'button.checkout', sourcePage: 'http://127.0.0.1:3000/billing' },
      ],
      forms: [],
      links: [],
      consoleErrors: [],
      networkErrors: [],
      timestamp: new Date().toISOString(),
    },
    {
      url: 'http://127.0.0.1:3000/admin',
      title: 'Organization Administration — Acme SaaS',
      depth: 1,
      elementsCount: 8,
      elements: [
        { type: 'button', tagName: 'button', text: 'Invite Member', selector: 'button.invite', sourcePage: 'http://127.0.0.1:3000/admin' },
      ],
      forms: [],
      links: [],
      consoleErrors: [],
      networkErrors: [],
      timestamp: new Date().toISOString(),
    },
  ];

  it('1. correctly classifies pages into deterministic semantic categories', () => {
    const classifications = SemanticPageClassifier.classifyAllPages(mockPages, 'http://127.0.0.1:3000');

    expect(classifications.length).toBe(6);
    expect(classifications.find((c) => c.pageUrl === 'http://127.0.0.1:3000/')?.category).toBe('LANDING');
    expect(classifications.find((c) => c.pageUrl === 'http://127.0.0.1:3000/login')?.category).toBe('LOGIN');
    expect(classifications.find((c) => c.pageUrl === 'http://127.0.0.1:3000/dashboard')?.category).toBe('DASHBOARD');
    expect(classifications.find((c) => c.pageUrl === 'http://127.0.0.1:3000/projects/new')?.category).toBe('CREATE');
    expect(classifications.find((c) => c.pageUrl === 'http://127.0.0.1:3000/billing')?.category).toBe('PAYMENT');
    expect(classifications.find((c) => c.pageUrl === 'http://127.0.0.1:3000/admin')?.category).toBe('ADMIN');
  });

  it('2. discovers cohesive product features from classified routes', () => {
    const classifications = SemanticPageClassifier.classifyAllPages(mockPages, 'http://127.0.0.1:3000');
    const features = FeatureDiscoveryEngine.discoverFeatures(mockPages, classifications);

    expect(features.length).toBeGreaterThanOrEqual(4);
    const authFeat = features.find((f) => f.id === 'feat-auth');
    expect(authFeat).toBeDefined();
    expect(authFeat?.name).toContain('Authentication');
    expect(authFeat?.isCoreCapability).toBe(true);

    const billingFeat = features.find((f) => f.id === 'feat-billing_payment');
    expect(billingFeat).toBeDefined();
    expect(billingFeat?.criticality.level).toBe('CRITICAL');

    const crudFeat = features.find((f) => f.id === 'feat-crud_projects');
    expect(crudFeat).toBeDefined();
  });

  it('3. discovers grounded user roles without hallucinating unbacked entities', () => {
    const classifications = SemanticPageClassifier.classifyAllPages(mockPages, 'http://127.0.0.1:3000');
    const features = FeatureDiscoveryEngine.discoverFeatures(mockPages, classifications);
    const roles = RoleDiscoveryEngine.discoverRoles(mockPages, classifications, features);

    expect(roles.length).toBeGreaterThanOrEqual(3);
    expect(roles.some((r) => r.id === 'role-visitor')).toBe(true);
    expect(roles.some((r) => r.id === 'role-member')).toBe(true);
    expect(roles.some((r) => r.id === 'role-admin')).toBe(true);

    const adminRole = roles.find((r) => r.id === 'role-admin');
    expect(adminRole?.status).toBe('OBSERVED');
    expect(adminRole?.observedCapabilities.length).toBeGreaterThan(0);
  });

  it('4. discovers multi-step user goal workflows with structured steps', () => {
    const classifications = SemanticPageClassifier.classifyAllPages(mockPages, 'http://127.0.0.1:3000');
    const features = FeatureDiscoveryEngine.discoverFeatures(mockPages, classifications);
    const roles = RoleDiscoveryEngine.discoverRoles(mockPages, classifications, features);

    const workflows = WorkflowDiscoveryEngine.discoverWorkflows({
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: {
        startUrl: 'http://127.0.0.1:3000',
        discoveredAt: new Date().toISOString(),
        totalPages: mockPages.length,
        totalLinks: 4,
        totalButtons: 4,
        totalForms: 2,
        totalInputs: 4,
        pages: mockPages,
      },
      classifications,
      features,
      roles,
    });

    expect(workflows.length).toBeGreaterThanOrEqual(3);
    const loginWf = workflows.find((w) => w.id === 'wf-member-authentication');
    expect(loginWf).toBeDefined();
    expect(loginWf?.steps.length).toBeGreaterThanOrEqual(2);
    expect(loginWf?.criticality.level).toBe('CRITICAL');

    const createWf = workflows.find((w) => w.id.includes('create-project'));
    expect(createWf).toBeDefined();
    expect(createWf?.steps.some((s) => s.actionType === 'FILL')).toBe(true);
  });

  it('5. builds complete ProductModel with graph relationships and coverage metrics', async () => {
    const appMap: ApplicationMap = {
      startUrl: 'http://127.0.0.1:3000',
      discoveredAt: new Date().toISOString(),
      totalPages: mockPages.length,
      totalLinks: 4,
      totalButtons: 4,
      totalForms: 2,
      totalInputs: 4,
      pages: mockPages,
    };

    const model = await ProductModelBuilder.build({
      testRunId: 'run-unit-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: appMap,
    });

    expect(model.applicationProfile.primaryType).toBe('SaaS');
    expect(model.applicationProfile.authenticationPresent).toBe(true);
    expect(model.applicationProfile.multiRoleSignals).toBe(true);
    expect(model.features.length).toBeGreaterThanOrEqual(4);
    expect(model.workflows.length).toBeGreaterThanOrEqual(3);
    expect(model.relationships.length).toBeGreaterThan(0);
    expect(model.coverage.totalWorkflows).toBe(model.workflows.length);
  });

  it('6. traces failure impact up to affected features and workflows via ProductGraph', () => {
    const classifications = SemanticPageClassifier.classifyAllPages(mockPages, 'http://127.0.0.1:3000');
    const features = FeatureDiscoveryEngine.discoverFeatures(mockPages, classifications);
    const roles = RoleDiscoveryEngine.discoverRoles(mockPages, classifications, features);
    const workflows = WorkflowDiscoveryEngine.discoverWorkflows({
      targetUrl: 'http://127.0.0.1:3000',
      pages: mockPages,
      classifications,
      features,
      roles,
    });

    const graph = new ProductGraph(roles, workflows, features, classifications);
    const impact = graph.traceFailureImpact('http://127.0.0.1:3000/projects/new', 'button[type="submit"]');

    expect(impact.affectedWorkflows.length).toBeGreaterThan(0);
    expect(impact.affectedFeatures.some((f) => f.id.includes('project'))).toBe(true);
    expect(impact.maxCriticalityScore).toBeGreaterThanOrEqual(70);
    expect(impact.impactSummary).toContain('workflow');
  });

  it('7. cleanly compares two product model versions detecting added/changed features and workflows', () => {
    const baseModel = {
      id: 'm1',
      version: '1.0',
      generatedAt: '',
      targetUrl: 'http://127.0.0.1:3000',
      applicationProfile: { primaryType: 'SaaS' as const } as any,
      pageClassifications: [],
      features: [
        { id: 'f-1', name: 'Auth', description: '', relatedPages: [], relatedControls: [], relatedForms: [], relatedRoutes: [], relatedWorkflowIds: [], confidence: 1, evidence: [], criticality: { score: 90, level: 'CRITICAL' as const, reasons: [], evidence: [], confidence: 1 }, status: 'OBSERVED' as const, isCoreCapability: true },
      ],
      roles: [{ id: 'r-1', name: 'visitor', confidence: 1, evidence: [], observedCapabilities: [], relatedFeatureIds: [], relatedWorkflowIds: [], status: 'OBSERVED' as const }],
      workflows: [
        { id: 'w-1', name: 'Login', goal: '', steps: [{} as any], entryPoint: '', exitPoint: '', relatedFeatureIds: [], relatedRoutes: [], confidence: 1, evidence: [], criticality: { score: 90, level: 'CRITICAL' as const, reasons: [], evidence: [], confidence: 1 }, status: 'CONFIRMED' as const, executionStatus: 'TESTED' as const },
      ],
      relationships: [],
      evidence: [],
      coverage: {} as any,
    };

    const updatedModel = {
      ...baseModel,
      features: [
        ...baseModel.features,
        { id: 'f-2', name: 'Billing', description: '', relatedPages: [], relatedControls: [], relatedForms: [], relatedRoutes: [], relatedWorkflowIds: [], confidence: 1, evidence: [], criticality: { score: 95, level: 'CRITICAL' as const, reasons: [], evidence: [], confidence: 1 }, status: 'OBSERVED' as const, isCoreCapability: true },
      ],
      workflows: [
        { ...baseModel.workflows[0], steps: [{} as any, {} as any] },
      ],
    };

    const diff = ProductModelBuilder.compareModels(baseModel, updatedModel);
    expect(diff.addedFeatures).toContain('Billing');
    expect(diff.changedWorkflows.some((w) => w.change === 'STEPS_CHANGED')).toBe(true);
  });
});
