# Development Manual - Sculra

This document details the local setup, workspaces structure, and testing foundations configurations.

---

## 1. Project Scaffolds

Sculra is organized as a monorepo under `pnpm` workspaces:

```text
sculra/
├── .github/          # GitHub Workflows & PR checklists
├── .vscode/          # Code settings & tasks configurations
├── backend/          # Express API server & Playwright runner sweeps
├── database/         # Supabase migrations & RLS policies
├── docs/             # Architectures & Brand manuals
├── frontend/         # Next.js 15 app router dashboard & pages
└── shared/           # Cross-package utils and TS models
```

---

## 2. Dev Environment Setup

1. **Prerequisites**: Ensure you have Node.js `v20+` and `pnpm v8+` installed globally.
2. **Install Workspace Packages**:
   ```bash
   pnpm install
   ```
3. **Environment Setup**:
   Copy `.env.example` to `.env` inside workspaces (e.g. `frontend/.env.local`) and configure keys.
4. **Boot Local Servers**:
   ```bash
   pnpm dev
   ```

---

## 3. Script Checklists

Use these workspace shortcuts from the repository root:

- `pnpm build`: Compiles all packages.
- `pnpm lint`: Checks style guidelines and code quality.
- `pnpm typecheck`: Compiles typescript targets cleanly.
- `pnpm format`: Runs Prettier check validations.
- `pnpm test`: Launches the Vitest test suites.

---

## 4. Testing Folder Layout (Foundations)

Sculra separates testing structures into three domains:
- **Unit Checks**: Located in `tests/unit/` (driven by Vitest).
- **DOM Integration Checks**: Located in `tests/integration/` (driven by Testing Library).
- **End-to-End browser sweeps**: Located in `tests/e2e/` (driven by Playwright).
