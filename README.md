# Sculra – Your AI QA Engineer

Sculra is a production-ready, enterprise-grade automated QA testing SaaS. It allows developers to upload website URLs, repositories, or application packages and autonomously performs crawling, page discovery, form validation, error interception, visual comparisons, and comprehensive bug tracking.

---

## 1. Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, TailwindCSS v4, Framer Motion, Radix UI.
- **Backend API & Queue**: Node.js, TypeScript, Express, BullMQ, Redis.
- **Database & Auth**: Supabase PostgreSQL (Row-Level Security enabled) + **Clerk Authentication**.
  _IMPORTANT: Supabase Auth is NOT used. Clerk manages all identity, OAuth, and sessions._
- **Error Tracking & Analytics**: Sentry (monitoring), PostHog (analytics).
- **Security**: Cloudflare (edge routing/rate-limiting/headers).

---

## 2. High-Level Architecture

Sculra utilizes a decoupled architecture designed for high availability and low latency:

1. **Next.js 15 Client**: Leverages React Server Components for fast initial paint and client components for real-time dashboard updates.
2. **Express API Server**: Handles Stripe checkout, webhook integrations, and pushes browser test jobs to a Redis-backed queue.
3. **Distributed Worker Nodes**:
   - **Browser Runner**: Uses Playwright to navigate pages, capture viewport screenshots, intercept console error logs, and record test runs.
   - **AI Agents Orchestration**: Independent reasoning agents (Tester, Designer, PM, Security, Accessibility) that interact with OpenAI/Anthropic APIs and database history.

---

## 3. Directory Layout

A summary of the core monorepo directories:

```text
Sculra/
├── .github/          # CI/CD Workflows and PR checks
├── .vscode/          # VS Code setting profiles
├── supabase/         # Local Supabase configurations & storage buckets
├── shared/           # Cross-workspace TypeScript typings and config details
├── frontend/         # Next.js 15 client dashboard and landing layouts
├── backend/          # Express API server and job workers
│   ├── agents/       # AI agents interfaces (PM, Tester, Designer, etc.)
│   └── browser/      # Playwright browser controller logic
├── scripts/          # Database seed and maintenance checks
└── .env.example      # App configuration variables template
```

For a comprehensive file-level breakdown, see [FolderStructure.md](file:///c:/Users/arman/OneDrive/Desktop/sculra/docs/FolderStructure.md).

---

## 4. One-Command local development setup

To spin up Sculra locally, follow these 5 steps:

1. **Install dependencies** (Use `pnpm` workspace manager):
   ```bash
   pnpm install
   ```
2. **Configure environment variables**:
   Copy `.env.example` to `frontend/.env.local` (and `backend/.env` if developing API servers) and configure keys.
3. **Start local Supabase** (Requires Docker and Supabase CLI installed):
   ```bash
   supabase start
   ```
4. **Start Sculra servers**:
   ```bash
   pnpm dev
   ```
5. **Open local website**:
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 5. Development Workflow & Standards

- **Conventional Commits**: Commits must follow `type(scope): message` standards (e.g. `feat(billing): configure Stripe checkout hook`).
- **No Implicit Any**: Zero `any` values in TypeScript. Enforce compile-level safety via `tsc --noEmit`.
- **Composition over Inheritance**: Custom UI components are designed as generic, composable elements styled dark-first with Tailwind.
- **Row-Level Security**: Ensure all database tables containing tenant records have active RLS policies.

For full coding policies, see [CodingStandards.md](file:///c:/Users/arman/OneDrive/Desktop/sculra/docs/CodingStandards.md).
For more infrastructure details, see [INFRASTRUCTURE.md](file:///c:/Users/arman/OneDrive/Desktop/sculra/docs/INFRASTRUCTURE.md).
