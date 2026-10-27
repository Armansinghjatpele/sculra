# Sculra Maintenance, Testing & Provisioning Scripts

This folder contains command-line TypeScript scripts used for dev system setup, database provisioning, migration testing, authenticated browser E2E, and isolated Supabase Row-Level Security (RLS) integration testing.

## Scripts

- `run-isolated-supabase-rls.ts`: Orchestrates real database-level Row-Level Security (RLS) and multi-tenant isolation integration tests. Enforces fail-closed production database protection and verifies authentic tenant identities before allowing any database interactions.
- `run-authenticated-browser-e2e.ts`: Safe-by-default browser-level end-to-end test runner for core user journeys with Clerk authentication and automatic prerequisite dependency blocking.
- `setup-db.ts`: Triggers schema reset or updates against local/staging dockerized database instances.

---

## Isolated Supabase RLS Testing Guide

### 1. Architecture & Security Safeguards

The isolated RLS test suite exercises real PostgreSQL Row-Level Security policies across 9 core multi-tenant scenarios.

**Critical Safety Rules:**
- **Production Guard**: Execution against production hostnames (`vycrimzpywqyjhtvvuax.supabase.co`, `sculra.com`, `api.sculra.com`) is strictly blocked.
- **Fail-Closed Remote Targets**: Remote databases are rejected unless `CONFIRM_ISOLATED_TEST_DB=true` is deliberately supplied.
- **Authentic Tokens**: Mock tokens (`mock_jwt_*`) are strictly rejected. Valid 3-part base64url Clerk JWTs with `sub` claims are required.
- **Fail-Closed Cleanup**: Fixture cleanup verifies that all 7 fixture categories (organizations, memberships, projects, test runs, issues, notification incidents, preferences) are completely deleted after test execution.

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


