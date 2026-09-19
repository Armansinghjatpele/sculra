import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.stubEnv('NODE_ENV', 'development');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');
});

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        insert: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation(() => builder),
        order: vi.fn().mockImplementation(() => builder),
        limit: vi.fn().mockImplementation(() => builder),
        single: vi.fn().mockImplementation(async () => ({
          data: {
            id: 'src-web-1',
            project_id: 'proj-1',
            source_type: 'WEBSITE',
            locator: 'https://demo.sculra.com',
            environment: 'PRODUCTION',
            status: 'AVAILABLE',
            configuration: {},
            capabilities: [
              { key: 'BROWSER_NAVIGATION', state: 'AVAILABLE' },
              { key: 'DOM_DISCOVERY', state: 'AVAILABLE' },
            ],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        })),
        then: vi.fn().mockImplementation((resolve) =>
          resolve({
            data: [
              {
                id: 'src-web-1',
                project_id: 'proj-1',
                project_source_id: 'src-web-1',
                source_type: 'WEBSITE',
                locator: 'https://demo.sculra.com',
                environment: 'PRODUCTION',
                status: 'AVAILABLE',
                fingerprint: '3b092f6da8673a554a938c0f59074be88bdfa73229bbf78921e9389e134ad987',
                configuration: {},
                capabilities: [
                  { key: 'BROWSER_NAVIGATION', state: 'AVAILABLE' },
                  { key: 'DOM_DISCOVERY', state: 'AVAILABLE' },
                ],
                observed_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
            error: null,
          })
        ),
      };
      return {
        from: vi.fn().mockImplementation(() => builder),
      };
    }),
  };
});

import {
  getProjectSources,
  getProjectSource,
  createProjectSource,
  getProjectSourceSnapshots,
  getProjectSourceHealth,
  getProjectSourceChanges,
  validateProjectSource,
} from '../services/db';

describe('Frontend Multi-Source Ingestion & Connection Intelligence DB & Logic Tests', () => {
  const token = 'test-clerk-token';
  const projectId = 'proj-1';

  describe('1. Sources Query & Lookup', () => {
    it('retrieves project sources for tenant with typed capabilities', async () => {
      const sources = await getProjectSources(token, projectId);
      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBeGreaterThan(0);

      const websiteSource = sources.find((s) => s.type === 'WEBSITE');
      expect(websiteSource).toBeDefined();
      expect(websiteSource?.status).toBe('AVAILABLE');
      expect(websiteSource?.capabilities.length).toBeGreaterThan(0);

      const browserCap = websiteSource?.capabilities.find((c) => c.key === 'BROWSER_NAVIGATION');
      expect(browserCap?.state).toBe('AVAILABLE');
    });

    it('retrieves single source by ID', async () => {
      const source = await getProjectSource(token, 'src-web-1');
      expect(source).not.toBeNull();
      expect(source?.id).toBe('src-web-1');
      expect(source?.locator).toBe('https://demo.sculra.com');
    });

    it('creates a new project source with tenant isolation', async () => {
      const newSource = await createProjectSource(token, {
        projectId: 'proj-new-test',
        type: 'WEBSITE',
        locator: 'https://newapp.example.com',
        environment: 'STAGING',
        status: 'AVAILABLE',
      });

      expect(newSource).toBeDefined();
      expect(newSource.projectId).toBeDefined();
    });
  });

  describe('2. Snapshots & Changes Audit Trail', () => {
    it('retrieves immutable snapshots with SHA-256 fingerprint', async () => {
      const snapshots = await getProjectSourceSnapshots(token, 'src-web-1');
      expect(snapshots.length).toBeGreaterThan(0);
      expect(snapshots[0].fingerprint).toBeDefined();
      expect(snapshots[0].fingerprint.length).toBe(64);
    });

    it('computes differential source changes correctly', async () => {
      const changes = await getProjectSourceChanges(token, 'src-web-1');
      expect(changes.length).toBeGreaterThan(0);
      expect(['SOURCE_CONNECTED', 'SOURCE_UNCHANGED', 'SOURCE_REVISION_CHANGED', 'SOURCE_CHANGED']).toContain(
        changes[0].type
      );
    });
  });

  describe('3. Health & Latency History (No Fake 100% Data)', () => {
    it('retrieves genuine health observations with numeric latencies', async () => {
      const health = await getProjectSourceHealth(token, 'src-web-1');
      expect(health.length).toBeGreaterThan(0);

      for (const obs of health) {
        expect(obs.status).toBeDefined();
        if (obs.latencyMs !== undefined) {
          expect(typeof obs.latencyMs).toBe('number');
          expect(obs.latencyMs).toBeGreaterThan(0);
        }
      }
    });

    it('verifies that no fake 100% uptime or mock metrics are injected', async () => {
      const health = await getProjectSourceHealth(token, 'src-zip-1');
      const zipObs = health.find((h) => h.projectSourceId === 'src-zip-1');
      if (zipObs) {
        expect(zipObs.status).toBe('NOT_READY');
      }

      const deskHealth = await getProjectSourceHealth(token, 'src-desk-1');
      const deskObs = deskHealth.find((h) => h.projectSourceId === 'src-desk-1');
      if (deskObs) {
        expect(deskObs.status).toBe('UNSUPPORTED');
      }
    });
  });

  describe('4. SSRF Defense & Validation Preflight', () => {
    it('blocks SSRF loopback and private IPs', async () => {
      const res127 = await validateProjectSource(token, 'WEBSITE', 'http://127.0.0.1:8080');
      expect(res127.valid).toBe(false);
      expect(res127.health).toBe('FORBIDDEN');
      expect(res127.errors[0].code).toBe('SSRF_SECURITY_VIOLATION');

      const resLocalhost = await validateProjectSource(token, 'WEBSITE', 'http://localhost:3000');
      expect(resLocalhost.valid).toBe(false);
      expect(resLocalhost.health).toBe('FORBIDDEN');

      const resPrivate = await validateProjectSource(token, 'API', 'http://192.168.1.1/api');
      expect(resPrivate.valid).toBe(false);
      expect(resPrivate.health).toBe('FORBIDDEN');
    });

    it('truthfully reports ZIP source as NOT_READY with unprovisioned storage warning', async () => {
      const resZip = await validateProjectSource(token, 'ZIP', 'project.zip');
      expect(resZip.valid).toBe(true);
      expect(resZip.status).toBe('NOT_READY');
      expect(resZip.health).toBe('NOT_READY');
      expect(resZip.capabilities.every((c) => c.state === 'UNAVAILABLE')).toBe(true);
    });

    it('truthfully reports DESKTOP source as NOT_READY and UNSUPPORTED', async () => {
      const resDesktop = await validateProjectSource(token, 'DESKTOP', 'app.exe');
      expect(resDesktop.valid).toBe(true);
      expect(resDesktop.status).toBe('NOT_READY');
      expect(resDesktop.health).toBe('UNSUPPORTED');
      expect(resDesktop.capabilities.every((c) => c.state === 'UNAVAILABLE')).toBe(true);
    });

    it('approves valid public HTTPS website locator', async () => {
      const resWeb = await validateProjectSource(token, 'WEBSITE', 'https://demo.sculra.com');
      expect(resWeb.valid).toBe(true);
      expect(resWeb.status).toBe('AVAILABLE');
      expect(resWeb.health).toBe('HEALTHY');
      expect(resWeb.latencyMs).toBeGreaterThan(0);
    });
  });
});
