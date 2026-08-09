# Sculra Backend API Server & Workers

This directory houses the backend API server and distributed queue worker nodes.

## Technologies

- Node.js & TypeScript
- Express.js
- Supabase (Postgres & Auth Integration)
- BullMQ (Redis-backed Queue Management)
- Sentry (Error Reporting)
- PostHog (Server-side Event Analytics)

## Directory Structure

```text
backend/
├── controllers/    # API endpoints handlers parsing requests
├── services/       # Core business logic orchestrators
├── repositories/   # Data query layer abstractions (Supabase client hooks)
├── routes/         # Express endpoint mappings
├── middleware/     # RBAC validation, CORS, token limits checks
├── workers/        # BullMQ background task workers
├── agents/         # AI Agent execution states
├── storage/        # Storage buckets access management
├── emails/         # Resend templates configuration
├── events/         # Local event handlers (Event Emitters)
├── jobs/           # Scheduled cron tasks (BullMQ scheduler)
├── queue/          # Redis configurations
├── config/         # Winston, Sentry, Redis credentials config
├── logger/         # Pino logger custom modules
└── utils/          # Standard security and formatting tools
```

