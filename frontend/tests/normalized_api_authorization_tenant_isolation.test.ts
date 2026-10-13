// ==============================================================================
// Normalized API Routes Authorization & Multi-Tenant Isolation Tests
// (frontend/tests/normalized_api_authorization_tenant_isolation.test.ts)
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Clerk server auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Database Service
const mockGetProject = vi.fn();
const mockGetProjectIncidents = vi.fn();
const mockGetProjectIncidentById = vi.fn();
const mockUpdateIncidentStatus = vi.fn();
const mockGetNotificationPreferences = vi.fn();
const mockUpdateNotificationPreference = vi.fn();
const mockGetDeliveryHealth = vi.fn();

vi.mock('@/services/db', () => ({
  getProject: (...args: any[]) => mockGetProject(...args),
  getProjectIncidents: (...args: any[]) => mockGetProjectIncidents(...args),
  getProjectIncidentById: (...args: any[]) => mockGetProjectIncidentById(...args),
  updateIncidentStatus: (...args: any[]) => mockUpdateIncidentStatus(...args),
  getNotificationPreferences: (...args: any[]) => mockGetNotificationPreferences(...args),
  updateNotificationPreference: (...args: any[]) => mockUpdateNotificationPreference(...args),
  getDeliveryHealth: (...args: any[]) => mockGetDeliveryHealth(...args),
}));

// Mock Supabase user client for authz organization lookup
const mockSupabaseClient = {
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
};
vi.mock('@/lib/supabase', () => ({
  getSupabaseUserClient: () => mockSupabaseClient,
}));

// Import normalized route handlers
import { GET as getIncidents } from '@/app/api/projects/[id]/incidents/route';
import {
  GET as getIncidentById,
  PATCH as patchIncident,
} from '@/app/api/projects/[id]/incidents/[incidentId]/route';
import {
  GET as getNotificationSettings,
  PATCH as patchNotificationSettings,
} from '@/app/api/projects/[id]/notification-settings/route';

describe('Normalized API Routes Authorization & Multi-Tenant Isolation', () => {
  const TENANT_1_ORG = 'org_tenant_1';
  const TENANT_2_ORG = 'org_tenant_2';
  const VALID_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
  const OTHER_PROJECT_ID = '00000000-0000-0000-0000-000000000002';
  const VALID_INCIDENT_ID = 'inc-101';

  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ----------------------------------------------------------------------------
  // 1. Unauthenticated Requests (HTTP 401)
  // ----------------------------------------------------------------------------
  describe('1. Unauthenticated Request Rejection (HTTP 401)', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        userId: null,
        orgId: null,
        orgRole: null,
        getToken: vi.fn().mockResolvedValue(null),
      });
    });

    it('rejects GET /api/projects/:id/incidents when unauthenticated', async () => {
      const req = new NextRequest(`http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents`);
      const res = await getIncidents(req, { params: Promise.resolve({ id: VALID_PROJECT_ID }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });

    it('rejects GET /api/projects/:id/incidents/:incidentId when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`
      );
      const res = await getIncidentById(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });

    it('rejects PATCH /api/projects/:id/incidents/:incidentId when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
        }
      );
      const res = await patchIncident(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });

    it('rejects GET /api/projects/:id/notification-settings when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`
      );
      const res = await getNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });

    it('rejects PATCH /api/projects/:id/notification-settings when unauthenticated', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ email_enabled: true }),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Authentication required');
    });
  });

  // ----------------------------------------------------------------------------
  // 2. Permission Denied (HTTP 403)
  // ----------------------------------------------------------------------------
  describe('2. Role Permission Boundaries (HTTP 403)', () => {
    it('rejects PATCH /api/projects/:id/incidents/:incidentId for VIEWER role without INCIDENTS_MANAGE', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_viewer_1',
        orgId: TENANT_1_ORG,
        orgRole: 'org:viewer',
        getToken: vi.fn().mockResolvedValue('jwt_viewer_token'),
      });
      mockGetProject.mockResolvedValue({
        id: VALID_PROJECT_ID,
        organization_id: TENANT_1_ORG,
        created_by: 'user_admin_1',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'RESOLVED' }),
        }
      );
      const res = await patchIncident(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('incidents.manage');
    });
  });

  // ----------------------------------------------------------------------------
  // 3. Nonexistent Projects & IDOR Protection (HTTP 404)
  // ----------------------------------------------------------------------------
  describe('3. Nonexistent Projects & Tenant Boundary Verification (HTTP 404)', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        userId: 'user_member_1',
        orgId: TENANT_1_ORG,
        orgRole: 'org:admin',
        getToken: vi.fn().mockResolvedValue('jwt_admin_token'),
      });
    });

    it('returns 404 when project does not exist for GET /incidents', async () => {
      mockGetProject.mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/proj-does-not-exist/incidents`
      );
      const res = await getIncidents(req, {
        params: Promise.resolve({ id: 'proj-does-not-exist' }),
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found or access denied');
    });

    it('returns 404 when project does not exist for GET /notification-settings', async () => {
      mockGetProject.mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/proj-does-not-exist/notification-settings`
      );
      const res = await getNotificationSettings(req, {
        params: Promise.resolve({ id: 'proj-does-not-exist' }),
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found or access denied');
    });

    it('strictly prevents cross-tenant access to another organization project (IDOR)', async () => {
      // User is in TENANT_1_ORG, but project belongs to TENANT_2_ORG
      mockGetProject.mockResolvedValue({
        id: OTHER_PROJECT_ID,
        organization_id: TENANT_2_ORG,
        clerkOrgId: TENANT_2_ORG,
        created_by: 'attacker_user_other_org',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${OTHER_PROJECT_ID}/incidents`
      );
      const res = await getIncidents(req, {
        params: Promise.resolve({ id: OTHER_PROJECT_ID }),
      });

      // Must return 404 rather than 403 to prevent probing project existence
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found or access denied');
      expect(mockGetProjectIncidents).not.toHaveBeenCalled();
    });

    it('strictly prevents cross-tenant modification of notification settings', async () => {
      mockGetProject.mockResolvedValue({
        id: OTHER_PROJECT_ID,
        organization_id: TENANT_2_ORG,
        clerkOrgId: TENANT_2_ORG,
        created_by: 'attacker_user_other_org',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${OTHER_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ email_enabled: false }),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: OTHER_PROJECT_ID }),
      });

      expect(res.status).toBe(404);
      expect(mockUpdateNotificationPreference).not.toHaveBeenCalled();
    });

    it('strictly prevents personal-workspace users from accessing another user personal project', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_personal_alice',
        orgId: null,
        orgRole: null,
        getToken: vi.fn().mockResolvedValue('jwt_alice_token'),
      });
      mockGetProject.mockResolvedValue({
        id: OTHER_PROJECT_ID,
        organization_id: null,
        created_by: 'user_personal_bob',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${OTHER_PROJECT_ID}/incidents`
      );
      const res = await getIncidents(req, {
        params: Promise.resolve({ id: OTHER_PROJECT_ID }),
      });
      expect(res.status).toBe(404);
      expect(mockGetProjectIncidents).not.toHaveBeenCalled();
    });

    it('strictly prevents personal-workspace users from accessing organization projects', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_personal_alice',
        orgId: null,
        orgRole: null,
        getToken: vi.fn().mockResolvedValue('jwt_alice_token'),
      });
      mockGetProject.mockResolvedValue({
        id: OTHER_PROJECT_ID,
        organization_id: TENANT_1_ORG,
        created_by: 'user_personal_alice',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${OTHER_PROJECT_ID}/incidents`
      );
      const res = await getIncidents(req, {
        params: Promise.resolve({ id: OTHER_PROJECT_ID }),
      });
      expect(res.status).toBe(404);
      expect(mockGetProjectIncidents).not.toHaveBeenCalled();
    });

    it('strictly prevents organization users from accessing personal projects of another user', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_org_member',
        orgId: TENANT_1_ORG,
        orgRole: 'org:admin',
        getToken: vi.fn().mockResolvedValue('jwt_org_token'),
      });
      mockGetProject.mockResolvedValue({
        id: OTHER_PROJECT_ID,
        organization_id: null,
        created_by: 'user_personal_bob',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${OTHER_PROJECT_ID}/incidents`
      );
      const res = await getIncidents(req, {
        params: Promise.resolve({ id: OTHER_PROJECT_ID }),
      });
      expect(res.status).toBe(404);
      expect(mockGetProjectIncidents).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // 4. Nonexistent Incident IDs & Cross-Project Protection (HTTP 404)
  // ----------------------------------------------------------------------------
  describe('4. Nonexistent Incident IDs & Scoping (HTTP 404)', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        userId: 'user_member_1',
        orgId: TENANT_1_ORG,
        orgRole: 'org:admin',
        getToken: vi.fn().mockResolvedValue('jwt_admin_token'),
      });
      mockGetProject.mockResolvedValue({
        id: VALID_PROJECT_ID,
        organization_id: TENANT_1_ORG,
        created_by: 'user_member_1',
      });
    });

    it('returns 404 for GET /incidents/:incidentId when incident is not found', async () => {
      mockGetProjectIncidentById.mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/inc-nonexistent`
      );
      const res = await getIncidentById(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: 'inc-nonexistent' }),
      });
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('Incident not found.');
    });

    it('returns 404 for PATCH /incidents/:incidentId when incident is not found in project', async () => {
      mockGetProjectIncidentById.mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/inc-nonexistent`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
        }
      );
      const res = await patchIncident(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: 'inc-nonexistent' }),
      });
      expect(res.status).toBe(404);
      expect(mockUpdateIncidentStatus).not.toHaveBeenCalled();
    });

    it('returns 400 when incident mutation fails at the project boundary', async () => {
      mockGetProjectIncidentById.mockResolvedValue({
        id: VALID_INCIDENT_ID,
        project_id: VALID_PROJECT_ID,
        status: 'OPEN',
      });
      mockUpdateIncidentStatus.mockResolvedValue(null);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'RESOLVED' }),
        }
      );
      const res = await patchIncident(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Incident update failed.');
      expect(mockUpdateIncidentStatus).toHaveBeenCalledWith(
        'jwt_admin_token',
        VALID_INCIDENT_ID,
        'RESOLVED',
        undefined,
        'user_member_1',
        VALID_PROJECT_ID
      );
    });
  });

  // ----------------------------------------------------------------------------
  // 5. Invalid Request Bodies (HTTP 400)
  // ----------------------------------------------------------------------------
  describe('5. Mutation Request Body Validation (HTTP 400)', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        userId: 'user_member_1',
        orgId: TENANT_1_ORG,
        orgRole: 'org:admin',
        getToken: vi.fn().mockResolvedValue('jwt_admin_token'),
      });
      mockGetProject.mockResolvedValue({
        id: VALID_PROJECT_ID,
        organization_id: TENANT_1_ORG,
        created_by: 'user_member_1',
      });
    });

    it('rejects PATCH /incidents/:incidentId with invalid transition status', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'MALICIOUS_STATE' }),
        }
      );
      const res = await patchIncident(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid incident status transition.');
    });

    it('rejects PATCH /notification-settings with invalid non-object body', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify(['invalid_array']),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Request body must be an object.');
    });

    it('rejects PATCH /notification-settings with unsupported arbitrary payload fields', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ email_enabled: true, malicious_injected_field: 'exploit' }),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid field in notification settings: "malicious_injected_field"');
      expect(mockUpdateNotificationPreference).not.toHaveBeenCalled();
    });

    it('rejects PATCH /notification-settings with empty body object', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({}),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('No notification preference fields provided to update.');
      expect(mockUpdateNotificationPreference).not.toHaveBeenCalled();
    });

    it('rejects PATCH /notification-settings with invalid enum values', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ channel: 'INVALID_CHANNEL' }),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid channel');
      expect(mockUpdateNotificationPreference).not.toHaveBeenCalled();
    });

    it('disallows client parameter tampering to override project_id or organization_id in notification settings', async () => {
      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ project_id: OTHER_PROJECT_ID, email_enabled: true }),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Invalid field in notification settings: "project_id"');
      expect(mockUpdateNotificationPreference).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------------
  // 6. Valid Authorized Requests (HTTP 200)
  // ----------------------------------------------------------------------------
  describe('6. Valid Authorized Operations (HTTP 200)', () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({
        userId: 'user_member_1',
        orgId: TENANT_1_ORG,
        orgRole: 'org:admin',
        getToken: vi.fn().mockResolvedValue('jwt_admin_token'),
      });
      mockGetProject.mockResolvedValue({
        id: VALID_PROJECT_ID,
        organization_id: TENANT_1_ORG,
        created_by: 'user_member_1',
      });
    });

    it('successfully queries GET /api/projects/:id/incidents', async () => {
      const mockIncidents = [
        { id: 'inc-1', project_id: VALID_PROJECT_ID, title: 'Flaky Auth Flow', status: 'OPEN' },
      ];
      mockGetProjectIncidents.mockResolvedValue(mockIncidents);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents?status=OPEN`
      );
      const res = await getIncidents(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
      expect(data.incidents[0].title).toBe('Flaky Auth Flow');
    });

    it('successfully queries GET /api/projects/:id/incidents/:incidentId', async () => {
      const mockInc = {
        id: VALID_INCIDENT_ID,
        project_id: VALID_PROJECT_ID,
        title: 'Network Timeout Spike',
        status: 'OPEN',
      };
      mockGetProjectIncidentById.mockResolvedValue(mockInc);

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`
      );
      const res = await getIncidentById(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.incident.title).toBe('Network Timeout Spike');
    });

    it('successfully updates PATCH /api/projects/:id/incidents/:incidentId', async () => {
      const mockInc = {
        id: VALID_INCIDENT_ID,
        project_id: VALID_PROJECT_ID,
        status: 'OPEN',
      };
      mockGetProjectIncidentById.mockResolvedValue(mockInc);
      mockUpdateIncidentStatus.mockResolvedValue({
        ...mockInc,
        status: 'RESOLVED',
        notes: 'Fixed bug in backend handler',
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/incidents/${VALID_INCIDENT_ID}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'RESOLVED', notes: 'Fixed bug in backend handler' }),
        }
      );
      const res = await patchIncident(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID, incidentId: VALID_INCIDENT_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.incident.status).toBe('RESOLVED');
      expect(mockUpdateIncidentStatus).toHaveBeenCalledWith(
        'jwt_admin_token',
        VALID_INCIDENT_ID,
        'RESOLVED',
        'Fixed bug in backend handler',
        'user_member_1',
        VALID_PROJECT_ID
      );
    });

    it('successfully queries GET /api/projects/:id/notification-settings', async () => {
      mockGetNotificationPreferences.mockResolvedValue({
        project_id: VALID_PROJECT_ID,
        email_enabled: true,
        slack_webhook_url: 'https://hooks.slack.com/services/...',
      });
      mockGetDeliveryHealth.mockResolvedValue({
        status: 'HEALTHY',
        last_delivered_at: new Date().toISOString(),
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`
      );
      const res = await getNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.preferences.email_enabled).toBe(true);
      expect(data.deliveryHealth.status).toBe('HEALTHY');
    });

    it('successfully updates PATCH /api/projects/:id/notification-settings', async () => {
      mockUpdateNotificationPreference.mockResolvedValue({
        project_id: VALID_PROJECT_ID,
        email_enabled: false,
      });

      const req = new NextRequest(
        `http://localhost:3000/api/projects/${VALID_PROJECT_ID}/notification-settings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ email_enabled: false }),
        }
      );
      const res = await patchNotificationSettings(req, {
        params: Promise.resolve({ id: VALID_PROJECT_ID }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.preference.email_enabled).toBe(false);
      expect(mockUpdateNotificationPreference).toHaveBeenCalledWith(
        'jwt_admin_token',
        {
          project_id: VALID_PROJECT_ID,
          clerk_user_id: 'user_member_1',
          organization_id: TENANT_1_ORG,
          email_enabled: false,
        }
      );
    });
  });
});
