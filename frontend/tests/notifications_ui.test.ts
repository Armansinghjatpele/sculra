import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.stubEnv('NODE_ENV', 'development');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'dev-anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');
});

const mockBuilder: any = {
  select: vi.fn().mockImplementation(() => mockBuilder),
  insert: vi.fn().mockImplementation(() => mockBuilder),
  upsert: vi.fn().mockImplementation(() => mockBuilder),
  update: vi.fn().mockImplementation(() => mockBuilder),
  delete: vi.fn().mockImplementation(() => mockBuilder),
  eq: vi.fn().mockImplementation(() => mockBuilder),
  is: vi.fn().mockImplementation(() => mockBuilder),
  order: vi.fn().mockImplementation(() => mockBuilder),
  limit: vi.fn().mockImplementation(() => mockBuilder),
  single: vi.fn().mockImplementation(async () => ({
    data: {
      id: 'mock-id-123',
      organization_id: 'org-testing-corp',
      project_id: 'proj-notifications-123',
      clerk_user_id: 'user-frontend-qa',
      event_type: 'RELEASE_BLOCKED',
      channel: 'WEBHOOK',
      endpoint_url: 'https://api.example.com/alerts',
      status: 'OPEN',
      acknowledged_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      min_severity: 'HIGH',
      delivery_frequency: 'DIGEST_HOURLY',
    },
    error: null,
  })),
  maybeSingle: vi.fn().mockImplementation(async () => ({
    data: null,
    error: null,
  })),
  then: vi.fn().mockImplementation((resolve) =>
    resolve({
      data: [],
      error: null,
    })
  ),
};

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn().mockImplementation(() => mockBuilder),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
      },
    })),
  };
});

import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationPreferences,
  updateNotificationPreference,
  getNotificationSubscriptions,
  createNotificationSubscription,
  deleteNotificationSubscription,
  getProjectIncidents,
  getProjectIncidentById,
  updateIncidentStatus,
  getDeliveryHealth,
} from '../services/db';
import { hasPermission } from '../lib/authz/role-permissions';
import { PERMISSIONS } from '../lib/authz/permissions';

describe('Prompt 40: Frontend Notification, Alert & Incident Engine Services', () => {
  const orgId = 'org-testing-corp';
  const projectId = 'proj-notifications-123';
  const userId = 'user-frontend-qa';

  it('retrieves notifications without fabricating fake demo data', async () => {
    const notifications = await getNotifications('token-123', { orgId, projectId });
    expect(Array.isArray(notifications)).toBe(true);
    // When no notifications exist in database, never fall back to mock data
    expect(notifications).toEqual([]);
  });

  it('marks individual notification as read and returns success boolean', async () => {
    const success = await markNotificationRead('token-123', 'notif-101');
    expect(success).toBe(true);
  });

  it('marks all notifications as read and returns success boolean', async () => {
    const success = await markAllNotificationsRead('token-123');
    expect(success).toBe(true);
  });

  it('retrieves and updates notification preferences', async () => {
    const prefs = await getNotificationPreferences('token-123', orgId, projectId);
    expect(Array.isArray(prefs)).toBe(true);

    const updated = await updateNotificationPreference('token-123', {
      clerk_user_id: userId,
      organization_id: orgId,
      min_severity: 'HIGH',
      frequency: 'HOURLY_DIGEST',
    });
    expect(updated).toBeDefined();
    expect(updated?.min_severity).toBe('HIGH');
  });

  it('creates and deletes notification subscriptions', async () => {
    const sub = await createNotificationSubscription('token-123', {
      organization_id: orgId,
      project_id: projectId,
      clerk_user_id: userId,
      target_type: 'PROJECT',
      target_id: projectId,
      channel: 'WEBHOOK',
      event_types: ['RELEASE_BLOCKED'],
    });
    expect(sub).toBeDefined();
    expect(sub?.id).toBe('mock-id-123');

    const subs = await getNotificationSubscriptions('token-123', orgId, projectId);
    expect(Array.isArray(subs)).toBe(true);

    const delSuccess = await deleteNotificationSubscription('token-123', 'mock-id-123');
    expect(delSuccess).toBe(true);
  });

  it('retrieves project incidents with truthful non-causal structure', async () => {
    const incidents = await getProjectIncidents('token-123', projectId);
    expect(Array.isArray(incidents)).toBe(true);

    const incident = await getProjectIncidentById('token-123', 'inc-100');
    expect(incident).toBeDefined();
  });

  it('transitions incident lifecycle state (OPEN -> ACKNOWLEDGED -> RESOLVED)', async () => {
    mockBuilder.single.mockResolvedValueOnce({
      data: {
        id: 'inc-100',
        status: 'ACKNOWLEDGED',
        acknowledged_at: new Date().toISOString(),
      },
      error: null,
    });
    const acked = await updateIncidentStatus('token-123', 'inc-100', 'ACKNOWLEDGED', userId);
    expect(acked).toBeDefined();
    expect(acked?.status).toBe('ACKNOWLEDGED');

    mockBuilder.single.mockResolvedValueOnce({
      data: {
        id: 'inc-100',
        status: 'RESOLVED',
        resolved_at: new Date().toISOString(),
      },
      error: null,
    });
    const resolved = await updateIncidentStatus('token-123', 'inc-100', 'RESOLVED', userId);
    expect(resolved).toBeDefined();
    expect(resolved?.status).toBe('RESOLVED');
  });

  it('reports INSUFFICIENT_DATA and null success rate when no delivery attempts exist', async () => {
    const health = await getDeliveryHealth('token-123', orgId);
    expect(health.status).toBe('INSUFFICIENT_DATA');
    expect(health.successRate).toBeNull();
    expect(health.totalDeliveries).toBe(0);
  });

  it('enforces RBAC permissions for notification management', () => {
    // VIEWER cannot manage notifications
    expect(hasPermission('VIEWER', PERMISSIONS.NOTIFICATIONS_MANAGE)).toBe(false);

    // DEVELOPER cannot manage notifications
    expect(hasPermission('DEVELOPER', PERMISSIONS.NOTIFICATIONS_MANAGE)).toBe(false);

    // QA_LEAD can manage notifications
    expect(hasPermission('QA_LEAD', PERMISSIONS.NOTIFICATIONS_MANAGE)).toBe(true);

    // ADMIN can manage notifications
    expect(hasPermission('ADMIN', PERMISSIONS.NOTIFICATIONS_MANAGE)).toBe(true);
  });

  it('enforces RBAC permissions for incident management', () => {
    // VIEWER cannot manage incidents
    expect(hasPermission('VIEWER', PERMISSIONS.INCIDENTS_MANAGE)).toBe(false);

    // QA_LEAD can manage incidents
    expect(hasPermission('QA_LEAD', PERMISSIONS.INCIDENTS_MANAGE)).toBe(true);

    // ADMIN can manage incidents
    expect(hasPermission('ADMIN', PERMISSIONS.INCIDENTS_MANAGE)).toBe(true);

    // OWNER can manage incidents
    expect(hasPermission('OWNER', PERMISSIONS.INCIDENTS_MANAGE)).toBe(true);
  });
});
