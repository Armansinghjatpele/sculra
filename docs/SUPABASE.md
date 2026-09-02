# Supabase Local Development Guide

Sculra utilizes Supabase for database schemas, database functions/triggers, object storage, and Row Level Security (RLS) data isolation.

_IMPORTANT: Supabase Auth is NOT used. User accounts and sessions management are handled exclusively by Clerk._

---

## 1. Local Stack Architecture

When running `supabase start`, Docker compose initializes the following services on your developer machine:

- **Postgres Database**: Port `54322` (DB connection endpoint).
- **Supabase Studio**: Port `54323` (web interface console to inspect tables/buckets).
- **API Gateway (Kong)**: Port `54321` (orchestrates functions and REST endpoint routes).
- **Inbucket (Email mock)**: Port `54324`.

---

## 2. CLI Workflow Cheat Sheet

- **Spin Up Local Containers**:
  ```bash
  supabase start
  ```
- **Stop Containers**:
  ```bash
  supabase stop
  ```
- **Inspect DB Status**:
  ```bash
  supabase status
  ```
- **Create Schema Migration File**:
  ```bash
  supabase migration new <migration_name>
  ```
  This creates a blank SQL file under `supabase/migrations/` to write SQL DDL commands (tables, triggers, policies).
- **Reset Database**:
  ```bash
  supabase db reset
  ```
  Applies all migration scripts from scratch and seeds data.
- **Generate Types for TypeScript**:
  ```bash
  supabase gen types typescript --local > ../shared/types/supabase.ts
  ```

---

## 3. Object Storage Buckets

Sculra organizes raw assets into isolated storage buckets. RLS rules secure these assets based on organization membership credentials:

- `screenshots`: Holds DOM screenshot captures (visual diff QA logs).
- `videos`: Holds Playwright test session video files.
- `reports`: Offline HTML/JSON test results files.
- `avatars`: User profile photos (public read permitted).
- `attachments`: Debug attachments and code archives.
- `exports`: Bulk test history log exports.

---

## 4. Server-Side Data Access

All backend APIs must connect using the `SUPABASE_SERVICE_ROLE_KEY` to perform write operations, but should map queries based on organization scoping parameters passed down by Clerk JWT validations.
