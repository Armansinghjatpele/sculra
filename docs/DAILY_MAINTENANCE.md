# Sculra Autonomous Daily Maintenance

The **Sculra Daily Maintenance** system keeps the repository clean, well-documented, strictly typed, and continuously tested with small, legitimate, low-risk automated improvements.

---

## 1. Philosophy & Core Rules

1. **At Most One Improvement Per UTC Day**: The system checks commit logs and will never make more than one maintenance commit per day.
2. **Real Improvements Only**: No empty commits, no meaningless churn, and no fake contribution metrics.
3. **Safety First**:
   - Authentication, database schemas/migrations, billing, security keys, and production logic are strictly protected by hard boundary checks.
   - If any test, linter, or build check fails, the working tree is immediately reverted and no commit is created.
4. **Transparent Attribution**:
   - Author: `sculra-bot <sculra-bot@users.noreply.github.com>`
   - Message: `chore(auto): daily Sculra maintenance YYYY-MM-DD`

---

## 2. Allowed vs Forbidden Scope

| Allowed Scope (Low Risk) | Strictly Forbidden Scope (Protected) |
| :--- | :--- |
| Documentation updates (`docs/**`, `README.md`, `CHANGELOG.md`) | Authentication & Clerk (`middleware.ts`, `**/auth/**`, `**/clerk/**`) |
| Edge-case test assertions in test suites | Database schemas & Supabase migrations (`supabase/migrations/**`) |
| Shared utility types & TSDoc annotations | Billing & Stripe integration (`**/billing/**`, `**/stripe/**`) |
| Code formatting (Prettier) & dead link fixes | Secrets & environment variables (`.env*`, `SECURITY.md`) |
| Input validator helpers & error descriptions | Production infrastructure & CI configurations |

---

## 3. How to Enable the System

The system runs automatically via GitHub Actions:

- **Schedule**: Executes daily at **03:00 UTC** via `.github/workflows/daily-maintenance.yml`.
- **Requirements**:
  - In your GitHub Repository:
    1. Go to **Settings** → **Actions** → **General**.
    2. Under **Workflow permissions**, select **Read and write permissions** (allows `sculra-bot` to push maintenance commits).
    3. Click **Save**.

### Optional: AI-Powered Suggestions
If you want to allow the maintenance system to generate context-aware code comments or doc refinements using Gemini:
1. Go to **Settings** → **Secrets and variables** → **Actions**.
2. Add a new repository secret named `GEMINI_API_KEY`.
3. If no key is set, the system automatically uses its deterministic rule-based maintenance engine.

---

## 4. How to Run a Manual Dry Run

You can trigger a maintenance check on-demand without committing or pushing:

### Via GitHub Actions UI:
1. Go to the **Actions** tab in your GitHub repository.
2. Select **Sculra Daily Maintenance** in the left sidebar.
3. Click **Run workflow**.
4. Check the **Dry run mode** checkbox (and optionally select a category).
5. Click **Run workflow**.

### Locally via Terminal:
```bash
# Dry-run across all categories
pnpm maintenance:daily --dry-run

# Run a specific category in dry-run mode
pnpm maintenance:daily --dry-run --category=docs
pnpm maintenance:daily --dry-run --category=tests
pnpm maintenance:daily --dry-run --category=types
```

---

## 5. How to Disable the System

To pause or disable autonomous daily maintenance:

- **Option A (GitHub UI)**: Go to **Actions** → **Sculra Daily Maintenance** → Click the `...` menu → **Disable workflow**.
- **Option B (Code)**: Comment out the `- cron: '0 3 * * *'` block in `.github/workflows/daily-maintenance.yml`.

---

## 6. How to Review Automated Changes

- All automated maintenance commits are tagged with:
  ```
  chore(auto): daily Sculra maintenance YYYY-MM-DD
  ```
- To review past automated commits:
  ```bash
  git log --author="sculra-bot" --oneline
  ```
- If you ever wish to revert an automated commit:
  ```bash
  git revert <commit-hash>
  git push origin main
  ```
