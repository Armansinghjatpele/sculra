# Sculra Maintenance, Testing & Provisioning Scripts

This folder contains command-line TypeScript scripts used for dev system setup, database provisioning, migration testing, authenticated browser E2E, and isolated Supabase Row-Level Security (RLS) integration testing.

## Scripts

- `run-isolated-supabase-rls.ts`: Orchestrates real database-level Row-Level Security (RLS) and multi-tenant isolation integration tests. Enforces fail-closed production database protection and verifies authentic tenant identities before allowing any database interactions.
- `run-authenticated-browser-e2e.ts`: Safe-by-default browser-level end-to-end test runner for core user journeys with Clerk authentication and automatic prerequisite dependency blocking.
- `setup-db.ts`: Triggers schema reset or updates against local/staging dockerized database instances.

---

## Isolated Supabase RLS Testing Guide

### 1. Architecture & Authorization Model

Sculra's Row-Level Security (RLS) architecture verifies tenant isolation across both the database membership boundary and Clerk JWT claims:
- **User Identity**: Extracted via `auth.jwt() ->> 'sub'` (wrapped in `public.clerk_user_id()`).
- **Organization Membership**: Validated by `public.is_org_member(target_org_id uuid)`, which requires caller's `clerk_user_id` to have an `active` row in `public.organization_memberships`.
- **Organization Identity Claim**: Extracted via `public.org_id()` (`org_id` or `orgId` claim in request JWT), evaluated in `public.organizations` RLS policy (`clerk_organization_id = public.org_id()`).
- **Strict Preconditions**: Fallback synthetic organization IDs (e.g. `org_test_a`, `org_test_b`) are strictly forbidden. `TEST_JWT_TENANT_A` and `TEST_JWT_TENANT_B` must each supply genuine, distinct organization claims.
- **Clerk API Limitation**: Clerk's backend `POST /v1/sessions` API issues user-scoped tokens. Unless the session has an active organization in Clerk, the minted JWT lacks `org_id`. For testing organization-scoped RLS policies, supply pre-minted organization tokens via `TEST_JWT_TENANT_A` and `TEST_JWT_TENANT_B`.

**Critical Safety Rules:**
- **Production Guard**: Execution against production hostnames (`vycrimzpywqyjhtvvuax.supabase.co`, `sculra.com`, `api.sculra.com`) is strictly blocked before any network activity or token operations.
- **Fail-Closed Remote Targets**: Remote databases are rejected unless `CONFIRM_ISOLATED_TEST_DB=true` is deliberately supplied.
- **Authentic & Distinct Identities**: Mock tokens (`mock_jwt_*`) are strictly rejected. Valid 3-part base64url Clerk JWTs with `sub` claims are required. Tenant A and Tenant B must supply distinct `org_id` claims (`tenantA.orgId !== tenantB.orgId`), and User C must represent a distinct personal identity that does not borrow tenant organization context.
- **Signature Boundary**: Preflight decoding inspects token claims for environment readiness; cryptographic signature verification is strictly enforced by PostgreSQL/PostgREST at the database boundary.
- **Exact Fixture Cleanup**: Fixtures are deleted in dependency-safe reverse order. Organization memberships are deleted strictly using exact `(organization_id, clerk_user_id)` key pairs to prevent deleting unrelated memberships. Absence of all 7 fixture categories is verified fail-closed after deletion.
- **Honest Runner Exit Codes**: The runner and `--check-only` audit strictly return non-zero (`exitCode: 2`) when prerequisites are missing or unsatisfied, returning `0` only when the test environment is fully verified and ready.

### 2. Environment Setup Options

#### Option A: Local Disposable Supabase Stack (Recommended)
1. **Prerequisite**: Ensure Docker Desktop is installed and running.
2. **Start Local Supabase Stack**:
   ```bash
   supabase start
   ```
   This provisions local containers on `http://127.0.0.1:54321` and automatically applies all migrations in `supabase/migrations/`.
3. **Configure Environment Variables**:
   ```bash
   export TEST_SUPABASE_URL=http://127.0.0.1:54321
   export TEST_SUPABASE_ANON_KEY=<local-anon-key-from-supabase-status>
   export TEST_SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key-from-supabase-status>
   export TEST_JWT_TENANT_A=<clerk-jwt-for-tenant-a>
   export TEST_JWT_TENANT_B=<clerk-jwt-for-tenant-b>
   export TEST_JWT_USER_C=<clerk-jwt-for-user-c>
   ```

#### Option B: Dedicated Non-Production Cloud Instance
1. Provision a dedicated staging/test Supabase project (separate from production `vycrimzpywqyjhtvvuax`).
2. Apply migrations:
   ```bash
   supabase db push --db-url "postgresql://postgres:<password>@db.<test-project-ref>.supabase.co:5432/postgres"
   ```
3. Configure environment variables:
   ```bash
   export TEST_SUPABASE_URL=https://<test-project-ref>.supabase.co
   export CONFIRM_ISOLATED_TEST_DB=true
   export TEST_SUPABASE_ANON_KEY=<test-anon-key>
   export TEST_SUPABASE_SERVICE_ROLE_KEY=<test-service-key>
   export TEST_JWT_TENANT_A=<clerk-jwt-for-tenant-a>
   export TEST_JWT_TENANT_B=<clerk-jwt-for-tenant-b>
   export TEST_JWT_USER_C=<clerk-jwt-for-user-c>
   ```

### 3. Execution Commands

- **Run Isolated RLS Test Suite**:
  ```bash
  pnpm run test:rls:isolated
  ```
- **Run Preflight Audit Only (No writes/tests executed)**:
  ```bash
  pnpm run test:rls:isolated -- --check-only
  ```
- **Stop Local Stack after testing**:
  ```bash
  supabase stop
  ```


