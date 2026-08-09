# Sculra Repository Folder Structure

This document details the folder structure and architectural components of the **Sculra** workspace.

---

## Workspace Layout

```text
Sculra/
├── .github/              # GitHub Actions workflows, issue templates, and CI/CD configs
├── assets/               # Branding assets, logos, and raw visual elements
├── backend/              # Node.js/Express API Gateway and Worker Architecture
│   ├── controllers/      # Route controllers mapping HTTP inputs to domain logic
│   ├── services/         # Orchestrators of business rules and external APIs
│   ├── repositories/     # Data access abstraction layers (Supabase/Postgres)
│   ├── routes/           # REST API endpoints mapping
│   ├── middleware/       # JWT auth, RBAC, rate-limiting, CORS, security headers
│   ├── workers/          # Background worker tasks polling queues
│   ├── agents/           # AI Agents (PM, Tester, Designer, Security, etc.)
│   ├── storage/          # Storage bucket integrations
│   ├── emails/           # Transactional mail templates (React Email / Resend)
│   ├── events/           # Internal event emitter schemas
│   ├── jobs/             # Scheduled cron jobs definitions
│   ├── queue/            # Redis / BullMQ connections and setup
│   ├── config/           # Application configuration files (Sentry, PostHog, Redis)
│   ├── logger/           # Winston/Pino logger setup
│   └── utils/            # Shared utility methods
├── database/             # Postgres & Supabase Database Configuration
│   ├── migrations/       # SQL migrations (schema definitions)
│   ├── seed/             # Seed files for development/testing environments
│   ├── policies/         # Supabase Row Level Security (RLS) policies
│   ├── sql/              # SQL custom functions and operations
│   ├── functions/        # Postgres stored procedures
│   └── triggers/         # Triggers (e.g., syncing auth users with profiles)
├── docs/                 # Complete architecture and developer docs
├── frontend/             # Next.js 15 App Router Frontend
│   ├── app/              # Routing structure (landing pages, dashboard, catch-all)
│   ├── components/       # Highly reusable UI components (shadcn/ui-inspired)
│   ├── features/         # Domain-isolated modules (billing, projects, etc.)
│   ├── hooks/            # Global custom React hooks
│   ├── providers/        # Global React providers (Theme, PostHog, Auth)
│   ├── services/         # API & Supabase Client interfaces
│   ├── lib/              # Library wrappers (Sentry, PostHog configuration)
│   ├── utils/            # Helper functions (formatting, validation)
│   ├── styles/           # Global tailwind styles and design system variables
│   ├── types/            # App-wide TypeScript typings
│   ├── config/           # App-wide global settings/constants
│   ├── middleware.ts     # Next.js session validation and route guards
│   ├── animations/       # Framer Motion configuration files
│   ├── icons/            # Scalable SVG icons and Lucide wrappers
│   ├── constants/        # Application limits, layout sizes, config constants
│   └── contexts/         # global React contexts (e.g., CommandMenu context)
├── public/               # Static media hosted at path "/"
├── shared/               # Code shared between frontend and backend
│   ├── types/            # Shared schemas and DTOs
│   ├── utils/            # Shared business validation rules
│   └── config/           # Monorepo wide environment structures
└── scripts/              # Setup, deploy, and seed utility scripts
```

---

## Directory Roles

1. **`frontend/`**: The frontend layer is structured such that all domain/feature specific logic is contained within the `features/` directory (e.g. `billing`, `projects`). Global items that transcend features (e.g. global dialogs, auth providers, general layouts) reside in global dirs like `components/`, `providers/`, and `app/`.
2. **`backend/`**: Follows a clean architecture separation: routing defines HTTP endpoints -> middleware performs auth and validation -> controller parses arguments -> service processes business rules -> repository queries the database. Heavy-lifting background tasks are deferred to `workers/` via `queue/`.
3. **`database/`**: Fully reflects Supabase structure. SQL schemas are version-controlled inside `migrations/`. Access control rules are documented inside `policies/`.
4. **`shared/`**: Contains pure TypeScript and configuration tools that prevent duplicate type definition files or format helpers between the frontend and backend.

