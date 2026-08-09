# Sculra Supabase Database Architecture

This directory contains the database structure, triggers, procedures, security policies, and storage configs for Sculra.

## Directory Structure

```text
database/
├── migrations/       # Schema definitions and version-controlled SQL migrations
├── seed/             # Dev seed scripts to populate mock organizations, users, and plans
├── policies/         # Row-Level Security (RLS) policies for secure multi-tenancy
├── sql/              # Pure SQL utility scripts
├── functions/        # Postgres stored procedures and RPC endpoints
├── triggers/         # Trigger functions bound to database lifecycle hooks
└── storage/          # Storage bucket structures (screenshots, videos, avaters, etc.)
```

## Setup Instructions

Ensure you have the Supabase CLI installed:

```bash
npm install -g supabase
```

To initialize and deploy database schemas:

1. Link to your remote project:
   ```bash
   supabase link --project-ref your-project-ref
   ```
2. Apply migrations:
   ```bash
   supabase db push
   ```

