// ==============================================================================
// Sculra Product Workflow Discovery Engine (worker/src/product/workflows.ts)
// ==============================================================================

import { ApplicationMap, DiscoveredPage } from '../types';
import { JourneyResult } from '../journeys/types';
import { BugObservation } from '../issues/types';
import {
  ProductWorkflow,
  WorkflowStep,
  SemanticPageClassification,
  ProductFeature,
  ProductRole,
  CriticalityAssessment,
  WorkflowExecutionStatus,
} from './types';

export class WorkflowDiscoveryEngine {
  /**
   * Discovers goal-oriented multi-step user workflows grounded in application navigation and forms.
   */
  public static discoverWorkflows(options: {
    targetUrl: string;
    applicationMap?: ApplicationMap;
    pages?: DiscoveredPage[];
    classifications: SemanticPageClassification[];
    features: ProductFeature[];
    roles: ProductRole[];
    journeyResults?: JourneyResult[];
    bugObservations?: BugObservation[];
  }): ProductWorkflow[] {
    const { targetUrl, applicationMap, classifications, features, roles, journeyResults, bugObservations } = options;
    const workflows: ProductWorkflow[] = [];
    const pages = options.pages || applicationMap?.pages || [];

    const pageCatMap = new Map<string, SemanticPageClassification>();
    for (const c of classifications) {
      pageCatMap.set(c.pageUrl, c);
    }

    const featureMap = new Map<string, ProductFeature>();
    for (const f of features) {
      featureMap.set(f.id, f);
    }

    const roleMap = new Map<string, ProductRole>();
    for (const r of roles) {
      roleMap.set(r.id, r);
    }

    // Helper to evaluate workflow execution status and link related issues
    const evaluateWorkflowExecution = (
      stepUrls: string[]
    ): {
      executionStatus: WorkflowExecutionStatus;
      testedIterations: number[];
      relatedIssueIds: string[];
      isConfirmed: boolean;
    } => {
      const relatedIssueIds: string[] = [];
      const testedIterations: number[] = [];

      // Check bug observations affecting any step URL
      if (bugObservations) {
        for (const bug of bugObservations) {
          if (stepUrls.some((u) => bug.url && u.replace(/\/$/, '') === bug.url.replace(/\/$/, ''))) {
            relatedIssueIds.push(bug.fingerprint || bug.id);
          }
        }
      }

      // Check journey results for execution match
      let matchedStepsCount = 0;
      let hasFailedJourney = false;

      if (journeyResults) {
        for (const j of journeyResults) {
          const visited = j.pagesVisited || [];
          const stepMatches = stepUrls.filter((u) => visited.some((v) => v.replace(/\/$/, '') === u.replace(/\/$/, ''))).length;

          if (stepMatches > 0) {
            matchedStepsCount = Math.max(matchedStepsCount, stepMatches);
            if (j.status === 'FAILED') {
              hasFailedJourney = true;
            }
          }
        }
      }

      if (hasFailedJourney || relatedIssueIds.length > 0) {
        return {
          executionStatus: matchedStepsCount >= stepUrls.length ? 'FAILED' : 'PARTIALLY_TESTED',
          testedIterations,
          relatedIssueIds,
          isConfirmed: false,
        };
      }

      if (matchedStepsCount >= stepUrls.length && stepUrls.length > 0) {
        return {
          executionStatus: 'TESTED',
          testedIterations,
          relatedIssueIds,
          isConfirmed: true,
        };
      }

      if (matchedStepsCount > 0) {
        return {
          executionStatus: 'PARTIALLY_TESTED',
          testedIterations,
          relatedIssueIds,
          isConfirmed: false,
        };
      }

      return {
        executionStatus: 'UNTESTED',
        testedIterations,
        relatedIssueIds,
        isConfirmed: false,
      };
    };

    // ---------------------------------------------------------------------------
    // 1. Visitor Onboarding & Registration Workflow
    // ---------------------------------------------------------------------------
    const landingPage = pages.find((p) => pageCatMap.get(p.url)?.category === 'LANDING');
    const signUpPage = pages.find((p) => pageCatMap.get(p.url)?.category === 'SIGN_UP');
    const dashboardPage = pages.find((p) => pageCatMap.get(p.url)?.category === 'DASHBOARD');

    if (landingPage && signUpPage) {
      const steps: WorkflowStep[] = [
        {
          id: 'step-onboard-1',
          stepNumber: 1,
          actionType: 'NAVIGATE',
          pageUrl: landingPage.url,
          targetDescription: 'Public Landing Page',
          expectedTransition: `Navigate to ${landingPage.url}`,
          evidence: [`Landing page entry: ${landingPage.url}`],
          confidence: 0.95,
        },
        {
          id: 'step-onboard-2',
          stepNumber: 2,
          actionType: 'CLICK',
          pageUrl: landingPage.url,
          targetSelector: 'a[href*="sign-up"], a[href*="register"], button',
          targetDescription: 'Sign Up / Register Call to Action',
          expectedTransition: `Transition to Registration page: ${signUpPage.url}`,
          evidence: [`Sign-up link leading to ${signUpPage.url}`],
          confidence: 0.9,
        },
        {
          id: 'step-onboard-3',
          stepNumber: 3,
          actionType: 'FILL',
          pageUrl: signUpPage.url,
          targetSelector: signUpPage.forms?.[0]?.submitSelector || 'form input',
          targetDescription: 'Account Registration Form',
          expectedTransition: 'Fill credentials and submit account registration',
          evidence: [`Registration form on ${signUpPage.url}`],
          confidence: 0.9,
        },
      ];

      if (dashboardPage) {
        steps.push({
          id: 'step-onboard-4',
          stepNumber: 4,
          actionType: 'TRANSITION',
          pageUrl: dashboardPage.url,
          targetDescription: 'Authenticated Dashboard',
          expectedTransition: `Redirect to user dashboard on completion: ${dashboardPage.url}`,
          evidence: [`Dashboard landing route: ${dashboardPage.url}`],
          confidence: 0.85,
        });
      }

      const stepUrls = steps.map((s) => s.pageUrl);
      const evalResult = evaluateWorkflowExecution(stepUrls);

      const criticality: CriticalityAssessment = {
        score: 92,
        level: 'CRITICAL',
        reasons: ['User onboarding & registration is the primary growth and acquisition funnel.'],
        evidence: [`Landing (${landingPage.url}) -> Sign-up (${signUpPage.url})`],
        confidence: 0.95,
      };

      workflows.push({
        id: 'wf-visitor-onboarding',
        name: 'Visitor Onboarding & Registration Flow',
        goal: 'Allow a new visitor to discover product capabilities and register an account.',
        roleId: 'role-visitor',
        roleName: 'Visitor / Unauthenticated User',
        steps,
        entryPoint: landingPage.url,
        exitPoint: dashboardPage?.url || signUpPage.url,
        relatedFeatureIds: ['feat-auth', 'feat-public_showcase'],
        relatedRoutes: [landingPage.url, signUpPage.url, ...(dashboardPage ? [dashboardPage.url] : [])],
        confidence: 0.95,
        evidence: ['Discovered landing and registration route chain.'],
        criticality,
        status: evalResult.isConfirmed ? 'CONFIRMED' : 'INFERRED',
        executionStatus: evalResult.executionStatus,
        testedIterations: evalResult.testedIterations,
        relatedIssueIds: evalResult.relatedIssueIds,
      });
    }

    // ---------------------------------------------------------------------------
    // 2. Authentication / Login Workflow
    // ---------------------------------------------------------------------------
    const loginPage = pages.find((p) => pageCatMap.get(p.url)?.category === 'LOGIN');
    if (loginPage) {
      const steps: WorkflowStep[] = [
        {
          id: 'step-login-1',
          stepNumber: 1,
          actionType: 'NAVIGATE',
          pageUrl: loginPage.url,
          targetDescription: 'User Sign-in Page',
          expectedTransition: `Navigate to sign-in page: ${loginPage.url}`,
          evidence: [`Login route: ${loginPage.url}`],
          confidence: 0.95,
        },
        {
          id: 'step-login-2',
          stepNumber: 2,
          actionType: 'FILL',
          pageUrl: loginPage.url,
          targetSelector: loginPage.forms?.[0]?.submitSelector || 'form input[type="email"], form input[type="password"]',
          targetDescription: 'Authentication Credentials Form',
          expectedTransition: 'Input user credentials and submit authentication request',
          evidence: [`Authentication form detected on ${loginPage.url}`],
          confidence: 0.9,
        },
      ];

      if (dashboardPage) {
        steps.push({
          id: 'step-login-3',
          stepNumber: 3,
          actionType: 'TRANSITION',
          pageUrl: dashboardPage.url,
          targetDescription: 'Authenticated User Dashboard',
          expectedTransition: `Redirect to dashboard upon successful login: ${dashboardPage.url}`,
          evidence: [`Dashboard destination: ${dashboardPage.url}`],
          confidence: 0.9,
        });
      }

      const stepUrls = steps.map((s) => s.pageUrl);
      const evalResult = evaluateWorkflowExecution(stepUrls);

      const criticality: CriticalityAssessment = {
        score: 95,
        level: 'CRITICAL',
        reasons: ['Authentication gateway protects all private workspace data and member capabilities.'],
        evidence: [`Login route: ${loginPage.url}`],
        confidence: 0.95,
      };

      workflows.push({
        id: 'wf-member-authentication',
        name: 'Member Authentication & Session Login',
        goal: 'Authenticate existing member into their workspace account.',
        roleId: 'role-member',
        roleName: 'Authenticated Member / User',
        steps,
        entryPoint: loginPage.url,
        exitPoint: dashboardPage?.url || loginPage.url,
        relatedFeatureIds: ['feat-auth'],
        relatedRoutes: [loginPage.url, ...(dashboardPage ? [dashboardPage.url] : [])],
        confidence: 0.95,
        evidence: ['Authentication form and login endpoints discovered.'],
        criticality,
        status: evalResult.isConfirmed ? 'CONFIRMED' : 'INFERRED',
        executionStatus: evalResult.executionStatus,
        testedIterations: evalResult.testedIterations,
        relatedIssueIds: evalResult.relatedIssueIds,
      });
    }

    // ---------------------------------------------------------------------------
    // 3. Core Resource Creation Workflows (e.g. Create Project / Item)
    // ---------------------------------------------------------------------------
    const createPages = pages.filter((p) => pageCatMap.get(p.url)?.category === 'CREATE');
    for (let i = 0; i < createPages.length; i++) {
      const createPage = createPages[i];
      let pathname = '';
      try {
        pathname = new URL(createPage.url).pathname;
      } catch {
        pathname = createPage.url;
      }

      const segments = pathname.split('/').filter(Boolean);
      const resourceName = segments[0] || 'Resource';
      const formattedName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);

      // Find matching list or dashboard page
      const parentListPage = pages.find((p) => {
        try {
          const pPath = new URL(p.url).pathname;
          return pPath === `/${resourceName}` || pPath === `/${resourceName}s` || pPath === '/dashboard';
        } catch {
          return false;
        }
      });

      const steps: WorkflowStep[] = [];
      if (parentListPage) {
        steps.push({
          id: `step-crud-${i}-1`,
          stepNumber: 1,
          actionType: 'NAVIGATE',
          pageUrl: parentListPage.url,
          targetDescription: `${formattedName} Overview / List Page`,
          expectedTransition: `Navigate to ${parentListPage.url}`,
          evidence: [`Parent route: ${parentListPage.url}`],
          confidence: 0.9,
        });
      }

      steps.push({
        id: `step-crud-${i}-2`,
        stepNumber: steps.length + 1,
        actionType: 'NAVIGATE',
        pageUrl: createPage.url,
        targetDescription: `Create ${formattedName} Form View`,
        expectedTransition: `Navigate to create form view: ${createPage.url}`,
        evidence: [`Creation form route: ${createPage.url}`],
        confidence: 0.9,
      });

      const form = createPage.forms?.[0];
      steps.push({
        id: `step-crud-${i}-3`,
        stepNumber: steps.length + 1,
        actionType: 'FILL',
        pageUrl: createPage.url,
        targetSelector: form?.submitSelector || 'form',
        targetDescription: `Fill and Submit ${formattedName} Details`,
        expectedTransition: `Save new ${formattedName.toLowerCase()} entity`,
        evidence: [`Interactive form with ${(form?.fields || []).length} field(s)`],
        confidence: 0.88,
      });

      const stepUrls = steps.map((s) => s.pageUrl);
      const evalResult = evaluateWorkflowExecution(stepUrls);

      const criticality: CriticalityAssessment = {
        score: 85,
        level: 'HIGH',
        reasons: [`Core creation flow for ${formattedName.toLowerCase()} resources is central to application productivity.`],
        evidence: [`Creation route: ${createPage.url}`],
        confidence: 0.9,
      };

      workflows.push({
        id: `wf-create-${resourceName.toLowerCase()}-${i + 1}`,
        name: `${formattedName} Creation & Configuration Flow`,
        goal: `Enable members to create and configure new ${formattedName.toLowerCase()} instances.`,
        roleId: 'role-member',
        roleName: 'Authenticated Member / User',
        steps,
        entryPoint: parentListPage?.url || createPage.url,
        exitPoint: createPage.url,
        relatedFeatureIds: [`feat-crud_${resourceName.toLowerCase()}`],
        relatedRoutes: steps.map((s) => s.pageUrl),
        confidence: 0.9,
        evidence: [`Resource creation forms detected on ${createPage.url}`],
        criticality,
        status: evalResult.isConfirmed ? 'CONFIRMED' : 'INFERRED',
        executionStatus: evalResult.executionStatus,
        testedIterations: evalResult.testedIterations,
        relatedIssueIds: evalResult.relatedIssueIds,
      });
    }

    // ---------------------------------------------------------------------------
    // 4. Subscription Checkout & Billing Workflow
    // ---------------------------------------------------------------------------
    const checkoutPage = pages.find((p) => pageCatMap.get(p.url)?.category === 'CHECKOUT' || pageCatMap.get(p.url)?.category === 'PAYMENT');
    const pricingPage = pages.find((p) => {
      try {
        return new URL(p.url).pathname.includes('pricing');
      } catch {
        return false;
      }
    });

    if (checkoutPage) {
      const steps: WorkflowStep[] = [];
      if (pricingPage) {
        steps.push({
          id: 'step-checkout-1',
          stepNumber: 1,
          actionType: 'NAVIGATE',
          pageUrl: pricingPage.url,
          targetDescription: 'Product Plans & Pricing Tier Selection',
          expectedTransition: `Review available tiers on ${pricingPage.url}`,
          evidence: [`Pricing route: ${pricingPage.url}`],
          confidence: 0.9,
        });
      }

      steps.push({
        id: 'step-checkout-2',
        stepNumber: steps.length + 1,
        actionType: 'NAVIGATE',
        pageUrl: checkoutPage.url,
        targetDescription: 'Subscription Payment & Checkout View',
        expectedTransition: `Navigate to checkout portal: ${checkoutPage.url}`,
        evidence: [`Checkout endpoint: ${checkoutPage.url}`],
        confidence: 0.95,
      });

      const stepUrls = steps.map((s) => s.pageUrl);
      const evalResult = evaluateWorkflowExecution(stepUrls);

      const criticality: CriticalityAssessment = {
        score: 98,
        level: 'CRITICAL',
        reasons: ['Revenue generation & payment processing pathway is business-critical.'],
        evidence: [`Checkout endpoint: ${checkoutPage.url}`],
        confidence: 0.95,
      };

      workflows.push({
        id: 'wf-subscription-checkout',
        name: 'Subscription Billing & Plan Checkout',
        goal: 'Complete plan upgrade, payment processing, and checkout.',
        roleId: 'role-customer',
        roleName: 'Customer / Subscriber',
        steps,
        entryPoint: pricingPage?.url || checkoutPage.url,
        exitPoint: checkoutPage.url,
        relatedFeatureIds: ['feat-billing_payment'],
        relatedRoutes: steps.map((s) => s.pageUrl),
        confidence: 0.95,
        evidence: ['Monetization and checkout endpoints discovered.'],
        criticality,
        status: evalResult.isConfirmed ? 'CONFIRMED' : 'INFERRED',
        executionStatus: evalResult.executionStatus,
        testedIterations: evalResult.testedIterations,
        relatedIssueIds: evalResult.relatedIssueIds,
      });
    }

    // ---------------------------------------------------------------------------
    // 5. Account Preferences & Configuration Workflow
    // ---------------------------------------------------------------------------
    const settingsPage = pages.find((p) => pageCatMap.get(p.url)?.category === 'SETTINGS' || pageCatMap.get(p.url)?.category === 'PROFILE');
    if (settingsPage) {
      const steps: WorkflowStep[] = [
        {
          id: 'step-settings-1',
          stepNumber: 1,
          actionType: 'NAVIGATE',
          pageUrl: settingsPage.url,
          targetDescription: 'Account Preferences & Security Settings',
          expectedTransition: `Navigate to settings: ${settingsPage.url}`,
          evidence: [`Settings route: ${settingsPage.url}`],
          confidence: 0.9,
        },
      ];

      const stepUrls = steps.map((s) => s.pageUrl);
      const evalResult = evaluateWorkflowExecution(stepUrls);

      const criticality: CriticalityAssessment = {
        score: 65,
        level: 'HIGH',
        reasons: ['User preferences and account configuration maintain user identity and security.'],
        evidence: [`Settings route: ${settingsPage.url}`],
        confidence: 0.85,
      };

      workflows.push({
        id: 'wf-account-settings',
        name: 'Account Preferences & Settings Management',
        goal: 'Update member profile details, notifications, and security preferences.',
        roleId: 'role-member',
        roleName: 'Authenticated Member / User',
        steps,
        entryPoint: settingsPage.url,
        exitPoint: settingsPage.url,
        relatedFeatureIds: ['feat-settings_admin'],
        relatedRoutes: [settingsPage.url],
        confidence: 0.9,
        evidence: ['Account preferences route detected.'],
        criticality,
        status: evalResult.isConfirmed ? 'CONFIRMED' : 'INFERRED',
        executionStatus: evalResult.executionStatus,
        testedIterations: evalResult.testedIterations,
        relatedIssueIds: evalResult.relatedIssueIds,
      });
    }

    return workflows;
  }
}
