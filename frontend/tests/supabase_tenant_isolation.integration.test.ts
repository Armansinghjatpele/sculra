// ==============================================================================
// Real Supabase Row-Level-Security (RLS) & Multi-Tenant Isolation Integration Test
// (frontend/tests/supabase_tenant_isolation.integration.test.ts)
// ==============================================================================
// WARNING: This test harness exercises real database queries and RLS policies.
// It strictly requires a dedicated isolated Supabase test environment
// (e.g. local Supabase container http://127.0.0.1:54321 or isolated test project).
//
// IT REFUSES TO RUN DESTRUCTIVE INTEGRATION TESTS AGAINST PRODUCTION DATA.
// Never uses mock tokens or placeholder credentials for authenticated DB requests.
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  validateRlsPreflight,
  formatPreflightReport,
  verifyServiceRoleConnection,
  TestFixtureRegistry,
} from './helpers/supabase_rls_preflight';

// ------------------------------------------------------------------------------
// 1. Preflight Configuration & Safety Validation
// ------------------------------------------------------------------------------
const preflight = validateRlsPreflight(process.env);

if (preflight.isBlocked) {
  console.warn('\n' + formatPreflightReport(preflight) + '\n');
}

const runOrSkip = preflight.isReady ? describe : describe.skip;

runOrSkip('Supabase Real Database RLS & Multi-Tenant Isolation Verification', () => {
  let adminClient: SupabaseClient;
  let tenantAClient: SupabaseClient;
  let tenantBClient: SupabaseClient;
  let personalUserCClient: SupabaseClient;
  let unauthenticatedClient: SupabaseClient;

  const fixtureRegistry = new TestFixtureRegistry();

  // Fresh, randomly generated UUIDs for this specific test execution
  const testOrgAId = crypto.randomUUID();
  const testOrgBId = crypto.randomUUID();
  const testProjectAId = crypto.randomUUID();
  const testProjectBId = crypto.randomUUID();
  const testPersonalProjectCId = crypto.randomUUID();
  const testPersonalProjectDId = crypto.randomUUID();
  const testIncidentAId = crypto.randomUUID();
  const testIncidentBId = crypto.randomUUID();
  const testRunAId = crypto.randomUUID();
  const testRunBId = crypto.randomUUID();
  const testIssueAId = crypto.randomUUID();
  const testIssueBId = crypto.randomUUID();

  // Extract authentic Clerk user identifiers from validated JWT claims
  const userAId = preflight.config?.tenantA.sub || `user_test_tenant_a_${crypto.randomUUID().slice(0, 8)}`;
  const userBId = preflight.config?.tenantB.sub || `user_test_tenant_b_${crypto.randomUUID().slice(0, 8)}`;
  const userCId = preflight.config?.userC.sub || `user_test_personal_c_${crypto.randomUUID().slice(0, 8)}`;
  const userDId = preflight.config?.userD?.sub || `user_test_personal_d_${crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    if (!preflight.isReady || !preflight.config) return;

    const { url, serviceRoleKey, anonKey, tenantA, tenantB, userC } = preflight.config;

    // 1. Initialize Service-Role Admin Client
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 2. Validate Service-Role Connection before touching any fixtures
    const connCheck = await verifyServiceRoleConnection(adminClient);
    if (!connCheck.ok) {
      throw new Error(`Admin service-role connection verification failed: ${connCheck.error}`);
    }

    // 3. Initialize Public / Unauthenticated Client
    unauthenticatedClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    // 4. Initialize Authenticated Tenant Clients with authentic, validated JWTs
    tenantAClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${tenantA.jwt}`,
        },
      },
    });

    tenantBClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${tenantB.jwt}`,
        },
      },
    });

    personalUserCClient = createClient(url, anonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${userC.jwt}`,
        },
      },
    });

    // 5. Provision Disposable Test Fixtures with atomic error checking & tracking
    try {
      // Organizations
      fixtureRegistry.recordOrg(testOrgAId);
      fixtureRegistry.recordOrg(testOrgBId);
      const { error: orgErr } = await adminClient.from('organizations').upsert([
        { id: testOrgAId, clerk_organization_id: tenantA.orgId || 'org_test_a', name: 'Test Tenant A', slug: `tenant-a-${testOrgAId.slice(0, 6)}` },
        { id: testOrgBId, clerk_organization_id: tenantB.orgId || 'org_test_b', name: 'Test Tenant B', slug: `tenant-b-${testOrgBId.slice(0, 6)}` },
      ]);
      if (orgErr) throw new Error(`Setup error (organizations): ${orgErr.message}`);

      // Organization Memberships (active status required by RLS)
      fixtureRegistry.recordMembership(testOrgAId, userAId);
      fixtureRegistry.recordMembership(testOrgBId, userBId);
      const { error: memErr } = await adminClient.from('organization_memberships').upsert([
        { organization_id: testOrgAId, clerk_user_id: userAId, role: 'admin', status: 'active' },
        { organization_id: testOrgBId, clerk_user_id: userBId, role: 'admin', status: 'active' },
      ]);
      if (memErr) throw new Error(`Setup error (organization_memberships): ${memErr.message}`);

      // Projects
      fixtureRegistry.recordProject(testProjectAId);
      fixtureRegistry.recordProject(testProjectBId);
      fixtureRegistry.recordProject(testPersonalProjectCId);
      fixtureRegistry.recordProject(testPersonalProjectDId);
      const { error: projErr } = await adminClient.from('projects').upsert([
        {
          id: testProjectAId,
          organization_id: testOrgAId,
          name: 'Project Tenant A',
          slug: `proj-tenant-a-${testProjectAId.slice(0, 6)}`,
          source_type: 'website',
          created_by: userAId,
        },
        {
          id: testProjectBId,
          organization_id: testOrgBId,
          name: 'Project Tenant B',
          slug: `proj-tenant-b-${testProjectBId.slice(0, 6)}`,
          source_type: 'website',
          created_by: userBId,
        },
        {
          id: testPersonalProjectCId,
          organization_id: null,
          name: 'Personal Project User C',
          slug: `proj-user-c-${testPersonalProjectCId.slice(0, 6)}`,
          source_type: 'website',
          created_by: userCId,
        },
        {
          id: testPersonalProjectDId,
          organization_id: null,
          name: 'Personal Project User D',
          slug: `proj-user-d-${testPersonalProjectDId.slice(0, 6)}`,
          source_type: 'website',
          created_by: userDId,
        },
      ]);
      if (projErr) throw new Error(`Setup error (projects): ${projErr.message}`);

      // Test Runs
      fixtureRegistry.recordTestRun(testRunAId);
      fixtureRegistry.recordTestRun(testRunBId);
      const { error: runErr } = await adminClient.from('test_runs').upsert([
        {
          id: testRunAId,
          organization_id: testOrgAId,
          project_id: testProjectAId,
          source_type: 'website',
          trigger_type: 'manual',
          status: 'passed',
          created_by: userAId,
        },
        {
          id: testRunBId,
          organization_id: testOrgBId,
          project_id: testProjectBId,
          source_type: 'website',
          trigger_type: 'manual',
          status: 'passed',
          created_by: userBId,
        },
      ]);
      if (runErr) throw new Error(`Setup error (test_runs): ${runErr.message}`);

      // Issues
      fixtureRegistry.recordIssue(testIssueAId);
      fixtureRegistry.recordIssue(testIssueBId);
      const { error: issueErr } = await adminClient.from('issues').upsert([
        {
          id: testIssueAId,
          organization_id: testOrgAId,
          project_id: testProjectAId,
          test_run_id: testRunAId,
          title: 'Issue Tenant A',
          severity: 'high',
          category: 'functional',
          status: 'open',
        },
        {
          id: testIssueBId,
          organization_id: testOrgBId,
          project_id: testProjectBId,
          test_run_id: testRunBId,
          title: 'Issue Tenant B',
          severity: 'high',
          category: 'functional',
          status: 'open',
        },
      ]);
      if (issueErr) throw new Error(`Setup error (issues): ${issueErr.message}`);

      // Notification Incidents
      fixtureRegistry.recordIncident(testIncidentAId);
      fixtureRegistry.recordIncident(testIncidentBId);
      const { error: incErr } = await adminClient.from('notification_incidents').upsert([
        {
          id: testIncidentAId,
          organization_id: testOrgAId,
          project_id: testProjectAId,
          status: 'OPEN',
          severity: 'HIGH',
          title: 'Incident Tenant A',
          summary: 'Test summary A',
          fingerprint: `fp-a-${testIncidentAId.slice(0, 6)}`,
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
          fingerprint: `fp-b-${testIncidentBId.slice(0, 6)}`,
          primary_entity_type: 'project',
          primary_entity_id: testProjectBId,
        },
      ]);
      if (incErr) throw new Error(`Setup error (notification_incidents): ${incErr.message}`);

      // Notification Preferences
      fixtureRegistry.recordPreference(testProjectAId);
      fixtureRegistry.recordPreference(testProjectBId);
      const { error: prefErr } = await adminClient.from('notification_preferences').upsert([
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
      if (prefErr) throw new Error(`Setup error (notification_preferences): ${prefErr.message}`);
    } catch (err) {
      // Partial setup failure: cleanup already recorded resources and fail setup
      await fixtureRegistry.cleanup(adminClient);
      throw err;
    }
  });

  afterAll(async () => {
    if (!preflight.isReady || !adminClient) return;

    // Reliable cleanup & verification
    const cleanupResult = await fixtureRegistry.cleanup(adminClient);
    if (!cleanupResult.success) {
      throw new Error(`Cleanup failed with errors: ${cleanupResult.errors.join('; ')}`);
    }

    const verification = await fixtureRegistry.verifyCleanedUp(adminClient);
    if (!verification.clean) {
      throw new Error(`Post-cleanup verification failed: lingering fixtures detected: ${verification.lingering.join('; ')}`);
    }
  });

  // ----------------------------------------------------------------------------
  // Scenario 1: Own-project, test runs, issues, and incidents access
  // ----------------------------------------------------------------------------
  it('1. Tenant A can access its own permitted project, test runs, issues, and incidents', async () => {
    const { data: projectA, error: pError } = await tenantAClient
      .from('projects')
      .select('*')
      .eq('id', testProjectAId)
      .maybeSingle();

    expect(pError).toBeNull();
    expect(projectA).not.toBeNull();
    expect(projectA?.id).toBe(testProjectAId);

    const { data: runs, error: rError } = await tenantAClient
      .from('test_runs')
      .select('*')
      .eq('project_id', testProjectAId);

    expect(rError).toBeNull();
    expect(runs).toHaveLength(1);
    expect(runs![0].id).toBe(testRunAId);

    const { data: issues, error: iError } = await tenantAClient
      .from('issues')
      .select('*')
      .eq('project_id', testProjectAId);

    expect(iError).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues![0].id).toBe(testIssueAId);

    const { data: incidents, error: incError } = await tenantAClient
      .from('notification_incidents')
      .select('*')
      .eq('project_id', testProjectAId);

    expect(incError).toBeNull();
    expect(incidents).toHaveLength(1);
    expect(incidents![0].id).toBe(testIncidentAId);
  });

  // ----------------------------------------------------------------------------
  // Scenario 2: Cross-organization project read and write denial
  // ----------------------------------------------------------------------------
  it('2. Tenant A cannot read or mutate Tenant B project', async () => {
    // Read denial: RLS filters out rows where is_org_member is false
    const { data: projectB, error: readError } = await tenantAClient
      .from('projects')
      .select('*')
      .eq('id', testProjectBId)
      .maybeSingle();

    expect(readError).toBeNull();
    expect(projectB).toBeNull();

    // Write denial: RLS USING clause prevents updating rows belonging to other orgs
    const { data: updatedB, error: writeError } = await tenantAClient
      .from('projects')
      .update({ name: 'Hacked Project B' })
      .eq('id', testProjectBId)
      .select();

    expect(writeError).toBeNull();
    expect(updatedB).toHaveLength(0);

    // Verify record was untouched in database via admin client
    const { data: intactProject } = await adminClient
      .from('projects')
      .select('name')
      .eq('id', testProjectBId)
      .single();
    expect(intactProject?.name).toBe('Project Tenant B');
  });

  // ----------------------------------------------------------------------------
  // Scenario 3: Cross-project incident query and mutation denial
  // ----------------------------------------------------------------------------
  it('3. Cross-project incident query returns empty and mutation fails at project boundary', async () => {
    const { data: incident, error: readError } = await tenantAClient
      .from('notification_incidents')
      .select('*')
      .eq('id', testIncidentBId)
      .eq('project_id', testProjectAId)
      .maybeSingle();

    expect(readError).toBeNull();
    expect(incident).toBeNull();

    const { data: updated, error: updateError } = await tenantAClient
      .from('notification_incidents')
      .update({ status: 'RESOLVED' })
      .eq('id', testIncidentBId)
      .eq('project_id', testProjectAId)
      .select();

    expect(updateError).toBeNull();
    expect(updated).toHaveLength(0);

    // Verify status was not modified
    const { data: intactIncident } = await adminClient
      .from('notification_incidents')
      .select('status')
      .eq('id', testIncidentBId)
      .single();
    expect(intactIncident?.status).toBe('OPEN');
  });

  // ----------------------------------------------------------------------------
  // Scenario 4: Personal-project isolation
  // ----------------------------------------------------------------------------
  it('4. Personal-workspace users cannot access another user personal project', async () => {
    // User C can read its own personal project
    const { data: ownProject, error: ownErr } = await personalUserCClient
      .from('projects')
      .select('*')
      .eq('id', testPersonalProjectCId)
      .maybeSingle();

    expect(ownErr).toBeNull();
    expect(ownProject).not.toBeNull();
    expect(ownProject?.id).toBe(testPersonalProjectCId);

    // User C cannot read User D's personal project
    const { data: otherProject, error: otherErr } = await personalUserCClient
      .from('projects')
      .select('*')
      .eq('id', testPersonalProjectDId)
      .maybeSingle();

    expect(otherErr).toBeNull();
    expect(otherProject).toBeNull();

    // User C cannot update User D's personal project
    const { data: updatedOther, error: updateErr } = await personalUserCClient
      .from('projects')
      .update({ name: 'Tampered Personal Project' })
      .eq('id', testPersonalProjectDId)
      .select();

    expect(updateErr).toBeNull();
    expect(updatedOther).toHaveLength(0);
  });

  // ----------------------------------------------------------------------------
  // Scenario 5: Unauthorized insertion into other tenant projects rejected
  // ----------------------------------------------------------------------------
  it('5. Unauthorized users cannot insert incidents into other tenant projects', async () => {
    const { data, error } = await tenantAClient
      .from('notification_incidents')
      .insert({
        project_id: testProjectBId,
        organization_id: testOrgBId,
        status: 'OPEN',
        severity: 'CRITICAL',
        title: 'Injected Incident',
        summary: 'Attacker payload',
        fingerprint: 'fp-injected-rls-test',
        primary_entity_type: 'project',
        primary_entity_id: testProjectBId,
      })
      .select();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    // PostgreSQL RLS error code 42501 (insufficient_privilege)
    expect(error?.code).toBe('42501');

    // Verify incident was not created in Tenant B project
    const { data: existing } = await adminClient
      .from('notification_incidents')
      .select('id')
      .eq('fingerprint', 'fp-injected-rls-test');
    expect(existing).toHaveLength(0);
  });

  // ----------------------------------------------------------------------------
  // Scenario 6: Notification preference isolation
  // ----------------------------------------------------------------------------
  it('6. Notification preferences cannot be read or changed across tenant boundaries', async () => {
    // Tenant A reading User B's preferences
    const { data: userBPrefs, error: readErr } = await tenantAClient
      .from('notification_preferences')
      .select('*')
      .eq('clerk_user_id', userBId);

    expect(readErr).toBeNull();
    expect(userBPrefs).toHaveLength(0);

    // Tenant A updating User B's preferences
    const { data: updated, error: updateErr } = await tenantAClient
      .from('notification_preferences')
      .update({ enabled: true })
      .eq('clerk_user_id', userBId)
      .select();

    expect(updateErr).toBeNull();
    expect(updated).toHaveLength(0);

    // Verify User B's preference is still disabled
    const { data: intactPref } = await adminClient
      .from('notification_preferences')
      .select('enabled')
      .eq('clerk_user_id', userBId)
      .single();
    expect(intactPref?.enabled).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Scenario 7: Cross-organization test runs and issues isolation
  // ----------------------------------------------------------------------------
  it('7. Tenant A cannot view or mutate Tenant B test runs and issues', async () => {
    // Tenant A reading Tenant B test runs
    const { data: runsB, error: runsErr } = await tenantAClient
      .from('test_runs')
      .select('*')
      .eq('project_id', testProjectBId);

    expect(runsErr).toBeNull();
    expect(runsB).toHaveLength(0);

    // Tenant A reading Tenant B issues
    const { data: issuesB, error: issuesErr } = await tenantAClient
      .from('issues')
      .select('*')
      .eq('project_id', testProjectBId);

    expect(issuesErr).toBeNull();
    expect(issuesB).toHaveLength(0);

    // Tenant A inserting a test run into Tenant B project
    const { data: insertedRun, error: insertRunErr } = await tenantAClient
      .from('test_runs')
      .insert({
        project_id: testProjectBId,
        organization_id: testOrgBId,
        source_type: 'website',
        trigger_type: 'manual',
        status: 'queued',
        created_by: userAId,
      })
      .select();

    expect(insertedRun).toBeNull();
    expect(insertRunErr).not.toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Scenario 8: Organization membership list privacy
  // ----------------------------------------------------------------------------
  it('8. Organization memberships cannot be viewed by other organizations', async () => {
    const { data: membershipsB, error: memErr } = await tenantAClient
      .from('organization_memberships')
      .select('*')
      .eq('organization_id', testOrgBId);

    expect(memErr).toBeNull();
    expect(membershipsB).toHaveLength(0);
  });

  // ----------------------------------------------------------------------------
  // Scenario 9: Unauthenticated requests completely denied by RLS
  // ----------------------------------------------------------------------------
  it('9. Unauthenticated requests are completely rejected by RLS across all resources', async () => {
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

    const { data: preferences } = await unauthenticatedClient
      .from('notification_preferences')
      .select('*')
      .eq('project_id', testProjectAId);

    expect(preferences).toHaveLength(0);
  });
});
