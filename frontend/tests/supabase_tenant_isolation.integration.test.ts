// ==============================================================================
// Real Supabase Row-Level-Security (RLS) & Multi-Tenant Isolation Integration Test
// (frontend/tests/supabase_tenant_isolation.integration.test.ts)
// ==============================================================================
// WARNING: This test harness exercises real database queries and RLS policies.
// It strictly requires a dedicated isolated Supabase test environment
// (e.g. local Supabase container http://127.0.0.1:54321 or isolated test project).
//
// IT REFUSES TO RUN DESTRUCTIVE INTEGRATION TESTS AGAINST PRODUCTION DATA.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Load test database configuration
const TEST_SUPABASE_URL = process.env.TEST_SUPABASE_URL;
const TEST_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
const TEST_SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

// Check whether an isolated test database is available
const isProductionDb =
  TEST_SUPABASE_URL?.includes('vycrimzpywqyjhtvvuax.supabase.co') ?? true;
const isIsolatedDbConfigured =
  Boolean(TEST_SUPABASE_URL) &&
  Boolean(TEST_SUPABASE_ANON_KEY) &&
  !isProductionDb;

const runOrSkip = isIsolatedDbConfigured ? describe : describe.skip;

if (!isIsolatedDbConfigured) {
  console.warn(
    '\n=============================================================================='
  );
  console.warn('[REAL SUPABASE TENANT-ISOLATION INTEGRATION TESTS: BLOCKED]');
  console.warn('Reason: No isolated Supabase test database environment is configured.');
  console.warn(
    'Production database protection active: Refusing to execute integration tests against'
  );
  console.warn('the shared/production Supabase project (vycrimzpywqyjhtvvuax.supabase.co).');
  console.warn(
    'To execute real RLS integration tests, configure:'
  );
  console.warn('  TEST_SUPABASE_URL=http://127.0.0.1:54321 (or isolated staging project)');
  console.warn('  TEST_SUPABASE_ANON_KEY=<test-anon-key>');
  console.warn('  TEST_SUPABASE_SERVICE_ROLE_KEY=<test-service-key>');
  console.warn(
    '==============================================================================\n'
  );
}

runOrSkip('Supabase Real Database RLS & Multi-Tenant Isolation Verification', () => {
  let adminClient: SupabaseClient;
  let tenantAClient: SupabaseClient;
  let tenantBClient: SupabaseClient;
  let personalUserCClient: SupabaseClient;
  let unauthenticatedClient: SupabaseClient;

  // Disposable Test Fixture IDs
  const testOrgAId = '00000000-0000-0000-0001-000000000001';
  const testOrgBId = '00000000-0000-0000-0002-000000000002';
  const testProjectAId = '00000000-0000-0000-0003-000000000001';
  const testProjectBId = '00000000-0000-0000-0003-000000000002';
  const testPersonalProjectCId = '00000000-0000-0000-0003-000000000003';
  const testPersonalProjectDId = '00000000-0000-0000-0003-000000000004';
  const testIncidentAId = '00000000-0000-0000-0004-000000000001';
  const testIncidentBId = '00000000-0000-0000-0004-000000000002';

  const userAId = 'user_test_tenant_a_1001';
  const userBId = 'user_test_tenant_b_2002';
  const userCId = 'user_test_personal_c_3003';
  const userDId = 'user_test_personal_d_4004';

  beforeAll(async () => {
    if (!isIsolatedDbConfigured) return;

    adminClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    unauthenticatedClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });

    // Initialize authenticated tenant clients with respective JWT claims
    tenantAClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: {
        headers: {
          // In Supabase Third-Party Auth, Clerk JWT sets sub and org_id
          Authorization: `Bearer ${process.env.TEST_JWT_TENANT_A || 'mock_jwt_a'}`,
        },
      },
    });

    tenantBClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${process.env.TEST_JWT_TENANT_B || 'mock_jwt_b'}`,
        },
      },
    });

    personalUserCClient = createClient(TEST_SUPABASE_URL!, TEST_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${process.env.TEST_JWT_USER_C || 'mock_jwt_c'}`,
        },
      },
    });

    // Provision disposable test fixtures via adminClient
    await adminClient.from('organizations').upsert([
      { id: testOrgAId, clerk_organization_id: 'org_test_a', name: 'Test Tenant A', slug: 'tenant-a' },
      { id: testOrgBId, clerk_organization_id: 'org_test_b', name: 'Test Tenant B', slug: 'tenant-b' },
    ]);

    await adminClient.from('organization_memberships').upsert([
      { organization_id: testOrgAId, clerk_user_id: userAId, role: 'admin' },
      { organization_id: testOrgBId, clerk_user_id: userBId, role: 'admin' },
    ]);

    await adminClient.from('projects').upsert([
      {
        id: testProjectAId,
        organization_id: testOrgAId,
        name: 'Project Tenant A',
        slug: 'proj-tenant-a',
        source_type: 'website',
        created_by: userAId,
      },
      {
        id: testProjectBId,
        organization_id: testOrgBId,
        name: 'Project Tenant B',
        slug: 'proj-tenant-b',
        source_type: 'website',
        created_by: userBId,
      },
      {
        id: testPersonalProjectCId,
        organization_id: null,
        name: 'Personal Project User C',
        slug: 'proj-user-c',
        source_type: 'website',
        created_by: userCId,
      },
      {
        id: testPersonalProjectDId,
        organization_id: null,
        name: 'Personal Project User D',
        slug: 'proj-user-d',
        source_type: 'website',
        created_by: userDId,
      },
    ]);

    await adminClient.from('notification_incidents').upsert([
      {
        id: testIncidentAId,
        organization_id: testOrgAId,
        project_id: testProjectAId,
        status: 'OPEN',
        severity: 'HIGH',
        title: 'Incident Tenant A',
        summary: 'Test summary A',
        fingerprint: 'fp-a-1',
        primary_entity_type: 'project',
        primary_entity_id: testProjectAId,
      },
      {
        id: testIncidentBId,
        organization_id: testOrgBId,
        project_id: testProjectBId,
        status: 'OPEN',
        severity: 'HIGH',
        title: 'Incident Tenant B',
        summary: 'Test summary B',
        fingerprint: 'fp-b-1',
        primary_entity_type: 'project',
        primary_entity_id: testProjectBId,
      },
    ]);

    await adminClient.from('notification_preferences').upsert([
      {
        clerk_user_id: userAId,
        organization_id: testOrgAId,
        project_id: testProjectAId,
        channel: 'EMAIL',
        frequency: 'IMMEDIATE',
        min_severity: 'HIGH',
        enabled: true,
      },
      {
        clerk_user_id: userBId,
        organization_id: testOrgBId,
        project_id: testProjectBId,
        channel: 'EMAIL',
        frequency: 'DAILY_DIGEST',
        min_severity: 'MEDIUM',
        enabled: false,
      },
    ]);
  });

  afterAll(async () => {
    if (!isIsolatedDbConfigured || !adminClient) return;

    // Reliable cleanup of all disposable test fixtures
    await adminClient.from('notification_preferences').delete().in('project_id', [testProjectAId, testProjectBId]);
    await adminClient.from('notification_incidents').delete().in('id', [testIncidentAId, testIncidentBId]);
    await adminClient
      .from('projects')
      .delete()
      .in('id', [testProjectAId, testProjectBId, testPersonalProjectCId, testPersonalProjectDId]);
    await adminClient.from('organization_memberships').delete().in('organization_id', [testOrgAId, testOrgBId]);
    await adminClient.from('organizations').delete().in('id', [testOrgAId, testOrgBId]);
  });

  // 1. Tenant A can access its own permitted project and incidents
  it('1. Tenant A can access its own permitted project and incidents', async () => {
    const { data: projectA, error: pError } = await tenantAClient
      .from('projects')
      .select('*')
      .eq('id', testProjectAId)
      .maybeSingle();

    expect(pError).toBeNull();
    expect(projectA).not.toBeNull();
    expect(projectA.id).toBe(testProjectAId);

    const { data: incidents, error: incError } = await tenantAClient
      .from('notification_incidents')
      .select('*')
      .eq('project_id', testProjectAId);

    expect(incError).toBeNull();
    expect(incidents).toHaveLength(1);
    expect(incidents![0].id).toBe(testIncidentAId);
  });

  // 2. Tenant A cannot read or mutate Tenant B's project
  it('2. Tenant A cannot read or mutate Tenant B project', async () => {
    const { data: projectB } = await tenantAClient
      .from('projects')
      .select('*')
      .eq('id', testProjectBId)
      .maybeSingle();

    // RLS policy prevents cross-tenant reads; returns null
    expect(projectB).toBeNull();

    const { data: updatedB, error } = await tenantAClient
      .from('projects')
      .update({ name: 'Hacked Project B' })
      .eq('id', testProjectBId)
      .select();

    expect(updatedB).toHaveLength(0);
  });

  // 3. Tenant A cannot access or mutate an incident from Tenant B's project by supplying that incident ID with Tenant A's project ID
  it('3. Cross-project incident query returns empty and mutation fails at project boundary', async () => {
    // Attempt to access Tenant B incident using Tenant A project scope
    const { data: incident } = await tenantAClient
      .from('notification_incidents')
      .select('*')
      .eq('id', testIncidentBId)
      .eq('project_id', testProjectAId)
      .maybeSingle();

    expect(incident).toBeNull();

    // Attempt to mutate Tenant B incident with Tenant A project scope
    const { data: updated } = await tenantAClient
      .from('notification_incidents')
      .update({ status: 'RESOLVED' })
      .eq('id', testIncidentBId)
      .eq('project_id', testProjectAId)
      .select();

    expect(updated).toHaveLength(0);
  });

  // 4. Personal-workspace users cannot access another user's personal project
  it('4. Personal-workspace users cannot access another user personal project', async () => {
    const { data: ownProject } = await personalUserCClient
      .from('projects')
      .select('*')
      .eq('id', testPersonalProjectCId)
      .maybeSingle();

    expect(ownProject).not.toBeNull();
    expect(ownProject.id).toBe(testPersonalProjectCId);

    const { data: otherProject } = await personalUserCClient
      .from('projects')
      .select('*')
      .eq('id', testPersonalProjectDId)
      .maybeSingle();

    // User D project is inaccessible to User C
    expect(otherProject).toBeNull();
  });

  // 5. Unauthorized users cannot bypass access restrictions by altering request parameters or payload identifiers
  it('5. Unauthorized users cannot insert incidents into other tenant projects', async () => {
    const { data, error } = await tenantAClient
      .from('notification_incidents')
      .insert({
        project_id: testProjectBId, // Attempt to inject into Tenant B project
        organization_id: testOrgBId,
        status: 'OPEN',
        severity: 'CRITICAL',
        title: 'Injected Incident',
        summary: 'Attacker payload',
        fingerprint: 'fp-injected',
        primary_entity_type: 'project',
        primary_entity_id: testProjectBId,
      })
      .select();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  // 6. Notification preferences cannot be read or changed across tenant boundaries
  it('6. Notification preferences cannot be read or changed across tenant boundaries', async () => {
    const { data: userBPrefs } = await tenantAClient
      .from('notification_preferences')
      .select('*')
      .eq('clerk_user_id', userBId);

    // RLS policy: USING (clerk_user_id = auth.jwt() ->> 'sub') prevents reading other user prefs
    expect(userBPrefs).toHaveLength(0);

    const { data: updated } = await tenantAClient
      .from('notification_preferences')
      .update({ enabled: true })
      .eq('clerk_user_id', userBId)
      .select();

    expect(updated).toHaveLength(0);
  });

  // 7. Unauthenticated and insufficient-permission requests remain denied
  it('7. Unauthenticated requests are completely rejected by RLS', async () => {
    const { data: projects } = await unauthenticatedClient
      .from('projects')
      .select('*')
      .eq('id', testProjectAId);

    expect(projects).toHaveLength(0);

    const { data: incidents } = await unauthenticatedClient
      .from('notification_incidents')
      .select('*')
      .eq('id', testIncidentAId);

    expect(incidents).toHaveLength(0);
  });
});
