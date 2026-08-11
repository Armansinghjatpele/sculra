# Development Manual - Sculra

This document details the local setup, workspaces structure, testing foundations, Docker runners, and Git hygiene constraints.

---

## 1. Project Workspaces

Sculra is organized as a monorepo under `pnpm` workspaces:

```text
sculra/
├── .github/          # GitHub Workflows & PR checklists
├── .vscode/          # Code settings & tasks configurations
├── supabase/         # Local Supabase configurations & buckets schema
├── backend/          # Express API server & Playwright runner sweeps
├── shared/           # Cross-package utils and TS models
├── frontend/         # Next.js 15 app router dashboard & pages
└── docs/             # Architectures & Brand manuals
```

---

## 2. Local Environment Setup

To run Sculra locally, follow this one-command workflow:

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```
2. **Configure Environment Variables**:
   Copy `.env.example` to `frontend/.env.local` and `backend/.env`. Configure required Clerk and Supabase variables.
3. **Start local Supabase services** (Requires Docker & Supabase CLI):
   ```bash
   supabase start
   ```
4. **Start Sculra Development Server**:
   ```bash
   pnpm dev
   ```
5. **Open local dashboard**:
   Go to `http://localhost:3000`.

---

## 3. Directory Execution Mapping for Scripts

All core commands must be run from the **repository root** using pnpm workspace filtering, or inside specific subdirectories if developing a single package independently:

| Script | Root Directory Command | Local Package Subdirectory Command |
|---|---|---|
| **Install** | `pnpm install` | - |
| **Dev Mode** | `pnpm dev` | `pnpm dev` (inside `/frontend` or `/backend`) |
| **Build** | `pnpm build` | `pnpm build` (inside `/frontend` or `/backend`) |
| **Lint** | `pnpm lint` | `pnpm lint` (inside `/frontend` or `/backend`) |
| **Type Check** | `pnpm typecheck` | `pnpm typecheck` (inside `/frontend` or `/backend`) |
| **Formatting** | `pnpm format` | `prettier --write .` |
| **Clean Build** | `pnpm clean` | - |

---

## 4. Docker Compose Environment

We provide a local Docker stack for background services and sandbox queues. To boot them:
```bash
docker-compose -f docker-compose.dev.yml up -d
```
Services included:
- **Redis (`sculra-redis-dev`)**: Event Queue and Cache grid on port `6379`.
- **Browser Worker (`sculra-browser-worker-dev`)**: Isolated Playwright Chromium runner on port `3005`.
- **AI Worker (`sculra-ai-worker-dev`)**: Local model inference loop.
- **Background Worker (`sculra-background-worker-dev`)**: Async job execution queues.

---

## 5. Git Hygiene & File Size Policies

To keep our repository lightweight, portable, and clean, strict Git check-in policies are enforced:

### 5.1 What Belongs Where

- **What Belongs in Git**:
  - Raw TypeScript, SQL migrations, HTML, CSS source files.
  - Configuration configurations (`.yaml`, `.json`, `.toml`).
  - Workflow templates and architectural documentation.
- **What Belongs in Supabase Storage**:
  - Visual QA test result screenshots.
  - Playwright screencasts and video test recordings.
  - Organization and user profile avatars.
- **What Belongs in Cloudflare R2 / Object Storage**:
  - Bulk raw exports of test logs data.
  - Big zipped code uploads.
- **What Belongs Only on the Developer's Machine**:
  - Local database caches and logs (`.next/`, `.cache/`, `node_modules/`).
  - `.env` and `.env.local` files containing secrets.

### 5.2 Strict File Size Rule
Never check in binary formats, weights files, compressed archives, or compiled applications. Keep files strictly under `5MB`. Large debugging files must be hosted in object storage buckets.
