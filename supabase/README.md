# Supabase Local Development - Sculra

This directory handles local database migrations, triggers, storage bucketing, and RLS policies configurations.

---

## 1. CLI Commands Cheat Sheet

Execute the following commands from the repository root:

- **Start Local Supabase Services**:
  ```bash
  supabase start
  ```
  *Launches Docker containers for local Postgres, API Gateway, Inbucket, and Studio (Studio accessible at `http://localhost:54323`).*

- **Stop Local Services**:
  ```bash
  supabase stop
  ```

- **Check Services Status**:
  ```bash
  supabase status
  ```

- **Reset Local Database**:
  ```bash
  supabase db reset
  ```
  *Wipes the local database, applies migrations, and seeds the db schema.*

- **Create a New Migration**:
  ```bash
  supabase migration new <migration_name>
  ```

- **Apply Migration Manually**:
  ```bash
  supabase migration up
  ```

- **Push Migrations to Remote DB**:
  ```bash
  supabase db push
  ```

- **Generate TypeScript Database Types**:
  ```bash
  supabase gen types typescript --local > ../shared/types/supabase.ts
  ```

---

## 2. local schema files structure

- `supabase/migrations/`: Database versioning schema migrations files.
- `supabase/seed/`: Default schemas seeding data.
- `supabase/functions/`: Deno Edge functions.
- `supabase/policies/`: Standard RLS directives.
