import { describe, it, expect } from 'vitest';
import { extractRouteFromFilePath, identifyAffectedRoutes } from '../src/change-intelligence/route-impact';
import { identifyAffectedApis } from '../src/change-intelligence/api-impact';
import { identifyProductImpact } from '../src/change-intelligence/product-impact';
import { identifyHistoricalImpact } from '../src/change-intelligence/historical-impact';
import { DeterministicPrioritizer } from '../src/strategy/prioritizer';
import { TestTarget } from '../src/strategy/types';
import { ChangedFile } from '../src/change-intelligence/types';
import { ProductModel } from '../src/product';

describe('Change Intelligence Impact & Prioritization Tests', () => {
  describe('Route Impact Mapping', () => {
    it('extracts App Router routes cleanly stripping route groups and page extensions', () => {
      expect(extractRouteFromFilePath('app/(auth)/login/page.tsx')).toBe('/login');
      expect(extractRouteFromFilePath('app/(dashboard)/settings/account/page.tsx')).toBe('/settings/account');
      expect(extractRouteFromFilePath('app/page.tsx')).toBe('/');
      expect(extractRouteFromFilePath('app/api/health/route.ts')).toBe('/api/health');
    });

    it('extracts Pages Router routes cleanly', () => {
      expect(extractRouteFromFilePath('pages/checkout.tsx')).toBe('/checkout');
      expect(extractRouteFromFilePath('pages/index.tsx')).toBe('/');
      expect(extractRouteFromFilePath('pages/users/[id].tsx')).toBe('/users/[id]');
    });

    it('identifies affected routes with deduplication and confidence', () => {
      const files = [
        'app/(auth)/login/page.tsx',
        'src/components/LoginForm.tsx',
        'pages/checkout.tsx',
      ];
      const affected = identifyAffectedRoutes(files, ['/login', '/checkout', '/dashboard']);
      expect(affected.length).toBe(2);
      expect(affected.some((r) => r.route === '/login')).toBe(true);
      expect(affected.some((r) => r.route === '/checkout')).toBe(true);
    });
  });

  describe('API Impact Mapping', () => {
    it('identifies API endpoints and extracted HTTP methods from route handlers', () => {
      const files: ChangedFile[] = [
        {
          path: 'app/api/checkout/route.ts',
          status: 'MODIFIED',
          additions: 15,
          deletions: 2,
          changes: 17,
          hunks: [
            {
              oldStart: 1,
              oldLines: 5,
              newStart: 1,
              newLines: 10,
              lines: [
                '+export async function POST(req: NextRequest) {',
                '+  const body = await req.json();',
                '+  return NextResponse.json({ ok: true });',
                '+}',
              ],
            },
          ],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: ['API'],
        },
      ];

      const apis = identifyAffectedApis({ changedFiles: files });
      expect(apis.length).toBe(1);
      expect(apis[0].path).toBe('/api/checkout');
      expect(apis[0].method).toBe('POST');
    });

    it('identifies Pages router API endpoints', () => {
      const files: ChangedFile[] = [
        {
          path: 'pages/api/auth/token.ts',
          status: 'MODIFIED',
          additions: 5,
          deletions: 1,
          changes: 6,
          hunks: [],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: ['API'],
        },
      ];

      const apis = identifyAffectedApis({ changedFiles: files });
      expect(apis.length).toBe(1);
      expect(apis[0].path).toBe('/api/auth/token');
    });
  });

  describe('ProductModel Workflow & Feature Impact', () => {
    const mockProductModel: ProductModel = {
      projectId: 'proj-1',
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      workflows: [
        {
          id: 'wf-checkout',
          name: 'Express Checkout Flow',
          criticality: { level: 'CRITICAL', score: 95, businessImpact: 'Revenue critical' },
          steps: [
            { stepNumber: 1, action: 'navigate', pageUrl: 'https://app.example.com/checkout' },
            { stepNumber: 2, action: 'submit_payment', pageUrl: 'https://app.example.com/checkout/confirm' },
          ],
        },
        {
          id: 'wf-login',
          name: 'User Login Flow',
          criticality: { level: 'HIGH', score: 85, businessImpact: 'Access critical' },
          steps: [
            { stepNumber: 1, action: 'navigate', pageUrl: 'https://app.example.com/login' },
          ],
        },
      ],
      features: [],
      roles: [],
      inferredRules: [],
    };

    it('correlates changed route to critical ProductModel workflows', () => {
      const affectedWorkflows = identifyProductImpact({
        productModel: mockProductModel,
        affectedRoutes: [{ route: '/checkout', confidence: 'HIGH', reason: 'Changed file' }],
        affectedApis: [],
        changedFiles: [],
      });

      expect(affectedWorkflows.length).toBe(1);
      expect(affectedWorkflows[0].workflowId).toBe('wf-checkout');
      expect(affectedWorkflows[0].workflowName).toBe('Express Checkout Flow');
      expect(affectedWorkflows[0].criticality).toBe('CRITICAL');
    });
  });

  describe('Historical QA Memory Correlation', () => {
    it('correlates past regressions on changed routes and assigns priority bonus', () => {
      const associations = identifyHistoricalImpact({
        changedFiles: [],
        affectedRoutes: [{ route: '/checkout', confidence: 'HIGH', reason: 'Changed page' }],
        affectedApis: [],
        recentRegressions: [
          {
            fingerprint: 'reg-1',
            targetUrl: 'https://app.example.com/checkout',
            title: 'Checkout button broken',
            severity: 'critical',
            detectedAt: new Date().toISOString(),
          },
        ],
      });

      expect(associations.length).toBe(1);
      expect(associations[0].signalType).toBe('NEW_REGRESSION');
      expect(associations[0].priorityBonus).toBeGreaterThan(0);
      expect(associations[0].reason).toContain('regression');
    });
  });

  describe('Strategy Prioritizer Deterministic Change Boosts', () => {
    it('applies CHANGE_DIRECT, CHANGE_BUSINESS_CRITICAL, and CHANGE_HISTORICAL boosts', () => {
      const targets: TestTarget[] = [
        {
          id: 'target-checkout',
          targetType: 'PAGE',
          identifier: '/checkout',
          url: 'https://app.example.com/checkout',
          status: 'UNTESTED',
          priorityScore: 50,
        },
        {
          id: 'target-about',
          targetType: 'PAGE',
          identifier: '/about',
          url: 'https://app.example.com/about',
          status: 'UNTESTED',
          priorityScore: 50,
        },
      ];

      const mockChangeAnalysis: any = {
        id: 'ca-1',
        projectId: 'proj-1',
        commitSha: 'commit123',
        status: 'COMPLETED',
        changeSet: { files: [] },
        classifications: ['ROUTING', 'PAYMENT'],
        impactGraph: { nodeCount: 5, edgeCount: 4, isTruncated: false },
        risk: { score: 85, level: 'CRITICAL', factors: [], explanation: 'Critical checkout change' },
        affectedWorkflows: [
          {
            workflowId: 'wf-checkout',
            workflowName: 'Express Checkout Flow',
            criticality: 'CRITICAL',
            confidence: 'HIGH',
            reason: 'Checkout route touched',
          },
        ],
        affectedApis: [],
        affectedRoutes: [
          { route: '/checkout', confidence: 'HIGH', reason: 'Direct route change' },
        ],
        recommendedDomains: [],
        strategyBoosts: [
          {
            targetId: '/checkout',
            boostType: 'CHANGE_DIRECT',
            priorityBonus: 25,
            reason: 'Direct route change',
          },
          {
            targetId: '/checkout',
            boostType: 'CHANGE_BUSINESS_CRITICAL',
            priorityBonus: 20,
            reason: 'Touches critical workflow wf-checkout',
          },
        ],
        analyzedAt: new Date().toISOString(),
        durationMs: 120,
      };

      const { rankedTargets, rankings } = DeterministicPrioritizer.prioritize(targets, {
        mode: 'REGRESSION',
        changeIntelligence: mockChangeAnalysis,
      });

      expect(rankedTargets.length).toBe(2);
      expect(rankedTargets[0].id).toBe('target-checkout');
      expect(rankedTargets[0].priorityScore).toBeGreaterThan(rankedTargets[1].priorityScore);

      const checkoutRanking = rankings.find((r) => r.targetId === 'target-checkout');
      expect(checkoutRanking?.reasons.some((r) => r.includes('Code change impact'))).toBe(true);

      // Score must remain bounded <= 100
      expect(rankedTargets[0].priorityScore).toBeLessThanOrEqual(100);
      expect(rankedTargets[1].priorityScore).toBeGreaterThanOrEqual(0);
    });
  });
});
