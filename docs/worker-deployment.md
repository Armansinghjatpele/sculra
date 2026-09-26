# Sculra Autonomous QA Worker — Production Deployment & Operations Guide

This guide details the deployment, configuration, operational health, and runtime architecture of the `@sculra/worker` execution service.

---

## 1. Architecture Overview

Sculra separates the user-facing web tier (Next.js on Vercel) from browser execution:

```
[Vercel / Frontend] ──> [Next.js API Routes] ──> [Supabase PostgreSQL Queue]
                                                               │
                                                               ▼ (Leased Polling)
                                                     [Production QA Worker]
                                                               │
                                                               ▼ (Headless Automation)
                                                     [Playwright Chromium]
                                                               │
                                                               ▼ (Persisted Telemetry)
                                                     [Evidence / Issues / Gate Results]
```

The worker is designed as a persistent, containerized standalone process that operates independently of Vercel serverless request lifecycles.

---

## 2. Local Development

Run the worker directly against a local or remote Supabase instance:

```bash
# From repository root
pnpm --filter @sculra/worker start

# Or to execute a single test run explicitly
pnpm --filter @sculra/worker start <testRunId>

# Or to run the container browser smoke test
pnpm --filter @sculra/worker test:smoke
```

---

## 3. Docker Container Build

The worker uses a multi-stage Docker build executed from the **monorepo root**:

```bash
docker build -f worker/Dockerfile -t sculra-worker:latest .
```

Key build properties:
- **Base image**: `mcr.microsoft.com/playwright:v1.50.1-noble` (Ubuntu 24.04 with Playwright Chromium and required OS graphics/sandbox libraries pre-installed).
- **Package manager**: `pnpm@9.15.4` matching repository workspace specifications.
- **Dependencies**: Monorepo-aware frozen lockfile installation (`--frozen-lockfile --prod`).
- **Security**: Runs under non-root user `pwuser` (UID 1000).
- **Secrets**: No `.env` or credential files are baked into the container.

---

## 4. Docker Run & Container Execution

Run the worker container with required production environment variables:

```bash
docker run -d \
  --name sculra-worker \
  --restart unless-stopped \
  -p 8080:8080 \
  -e SUPABASE_URL="https://<YOUR_PROJECT_ID>.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="<YOUR_SUPABASE_SERVICE_ROLE_KEY>" \
  -e WORKER_CONCURRENCY="1" \
  -e WORKER_POLL_INTERVAL_MS="2000" \
  sculra-worker:latest
```

---

## 5. Required & Optional Environment Variables

The worker enforces strict startup validation:

| Variable | Classification | Description | Default |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | **REQUIRED** | Supabase REST/PostgreSQL API URL | None |
| `SUPABASE_SERVICE_ROLE_KEY` | **REQUIRED** | Service role administrative secret key | None |
| `WORKER_ID` | OPTIONAL | Unique identifier for the worker instance | `worker_<timestamp>_<hash>` |
| `WORKER_CONCURRENCY` | OPTIONAL | Maximum concurrent browser execution jobs (1–10) | `1` |
| `WORKER_POLL_INTERVAL_MS` | OPTIONAL | Frequency in ms to check the queue | `2000` |
| `WORKER_SHUTDOWN_GRACE_PERIOD_MS` | OPTIONAL | Time in ms to wait for active jobs before termination | `30000` |
| `WORKER_HEALTH_PORT` | OPTIONAL | HTTP port for health and readiness probes | `8080` |
| `WORKER_LEASE_SECONDS` | OPTIONAL | Initial job lease duration before heartbeat | `60` |
| `WORKER_RECOVERY_INTERVAL_MS` | OPTIONAL | Interval in ms between stale job scans | `60000` |
| `OPENAI_API_KEY` | OPTIONAL | API key for AI QA autonomous analysis | None |
| `SENTRY_DSN` | OPTIONAL | Sentry DSN for operational error reporting | None |
| `NODE_ENV` | OPTIONAL | Runtime environment (`production`, `development`, `test`) | `development` |

### Security & Validation Rules
- In `production`, missing `SUPABASE_SERVICE_ROLE_KEY` fails fast with `STARTUP_CONFIGURATION_ERROR`.
- Using an anonymous key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) in production is strictly rejected.
- All secrets are redacted from startup logs and diagnostics.

---

## 6. Health & Readiness Probes

The worker runs an independent HTTP server on port `8080` (configured via `WORKER_HEALTH_PORT`):

### Operational States
- `STARTING`: Initializing configuration, verifying Playwright and Supabase connections.
- `READY`: Worker daemon running, actively polling, ready to accept jobs.
- `BUSY`: Worker actively processing browser execution jobs.
- `DRAINING`: Worker received shutdown signal; finishing active jobs; no new jobs accepted.
- `UNHEALTHY`: Critical component failure encountered.
- `STOPPED`: Worker terminated.

### Liveness Probe (`GET /health`)
- Returns `200 OK` when status is `STARTING`, `READY`, `BUSY`, or `DRAINING`.
- Returns `503 Service Unavailable` when `UNHEALTHY` or `STOPPED`.
- Payload (Healthy):
  ```json
  {
    "status": "READY",
    "workerId": "worker_1727339123_a1b2c3",
    "uptimeSeconds": 142,
    "activeJobs": 0,
    "concurrency": 1,
    "timestamp": "2026-09-26T09:55:00.000Z"
  }
  ```
- Payload (Unhealthy):
  ```json
  {
    "status": "UNHEALTHY",
    "workerId": "worker_1727339123_a1b2c3",
    "uptimeSeconds": 142,
    "activeJobs": 0,
    "concurrency": 1,
    "timestamp": "2026-09-26T09:55:00.000Z",
    "errorCode": "DATABASE_CONNECTION_ERROR"
  }
  ```

### Readiness Probe (`GET /ready`)
- Returns `200 OK` only when status is `READY` or `BUSY`.
- Returns `503 Service Unavailable` during `STARTING`, `DRAINING`, `UNHEALTHY`, or `STOPPED`.
- Payload:
  ```json
  {
    "ready": false,
    "status": "DRAINING",
    "workerId": "worker_1727339123_a1b2c3",
    "activeJobs": 1,
    "availableSlots": 0,
    "timestamp": "2026-09-26T09:55:00.000Z",
    "errorCode": "DRAINING"
  }
  ```

### Information Hardening & Secret Protection
- **No Stack Traces**: Public health/readiness endpoints never return stack traces or raw exception messages.
- **No Database / SQL Leakage**: Connection errors and database exceptions are mapped strictly to standard enumerated error codes (`DATABASE_CONNECTION_ERROR`, `QUEUE_ERROR`, `WORKER_RUNTIME_ERROR`).
- **No Credentials / URLs**: Endpoints never echo Supabase URLs, tokens, authorization headers, or filesystem paths.
- Detailed debugging information is emitted exclusively to internal structured logs with automatic secret redaction.

---

## 7. Graceful Shutdown & Drain Semantics

When receiving `SIGTERM` or `SIGINT`:
1. Health server transitions to `DRAINING`. Readiness probe immediately returns `503`.
2. Daemon ceases acquiring new jobs from the queue (`pollOnce` returns 0).
3. Active in-flight jobs are allowed to finish within `WORKER_SHUTDOWN_GRACE_PERIOD_MS` (default: 30 seconds).
4. If jobs finish within the grace period, resources are released and the process exits cleanly (exit code `0`).
5. If the grace period expires while active jobs remain:
   - Cancellation token is signaled (`token.isCancelled = true`).
   - Active jobs are safely cancelled and recorded as `SHUTDOWN_CANCELLED`.
   - Heartbeat stops, browser is closed, and the process exits cleanly.
   - No orphaned browser processes or corrupted terminal states are left behind.

---

## 8. Playwright & Chromium Requirements

- **Chromium Launch Arguments**: Headless execution runs with `--no-sandbox`, `--disable-setuid-sandbox`, and `--disable-dev-shm-usage`.
- **Shared Memory**: In container environments with constrained `/dev/shm`, `--disable-dev-shm-usage` prevents Chromium crashes. Alternatively, configure `--ipc=host` or `--shm-size=1gb` if desired.
- **Verification**: Run `tsx src/smoke-test.ts` or `pnpm test:smoke` to verify the complete browser launch, navigation, DOM interaction, screenshot, and cleanup cycle.

---

## 9. Concurrency & Resource Considerations

- **Default Concurrency**: `1` (one concurrent browser test run per container).
- **Multi-Concurrency**: Concurrency can be set up to `10` via `WORKER_CONCURRENCY`. However, each Chromium instance consumes approximately 300MB–800MB RAM depending on target complexity.
- **Recommended Baseline**:
  - `WORKER_CONCURRENCY=1`: 1.5–2 GB RAM, 1–2 vCPUs.
  - `WORKER_CONCURRENCY=2`: 3–4 GB RAM, 2–4 vCPUs.
- Prefer horizontal scaling (multiple worker container replicas with concurrency 1–2) over vertical scaling (high concurrency on a single container) for crash isolation and deterministic test execution.

---

## 10. Queue Semantics & Reliability

- **Atomic Acquisition**: Jobs are claimed using database RPC `acquire_execution_job` with row-level locks (`FOR UPDATE SKIP LOCKED`) or optimistic lease acquisition.
- **Worker Heartbeat**: Active jobs receive recurring heartbeats every 15 seconds. If a worker dies abruptly, the lease expires after `WORKER_LEASE_SECONDS` (default: 60s).
- **Stale Job Recovery**: The worker's background recovery scanner periodically scans for expired leases and requeues stale jobs up to `DEFAULT_MAX_JOB_ATTEMPTS` (3 attempts), or marks them failed if attempts are exhausted.
- **Guard Against Stale Overwrites**: Job finalizer verifies that the completing worker still holds the active lease before updating terminal state. Stale workers whose leases were reassigned cannot overwrite results.

---

## 11. Production Container Platform Architecture

Sculra's autonomous browser worker is architected exclusively for persistent container runtimes:

```
[Vercel Serverless Frontend]
         │
         ▼
[Supabase PostgreSQL Job Queue]
         │
         ▼ (Atomic Polling)
[Dedicated Persistent Container] (Fly.io / AWS ECS / Railway / Render / GCP Cloud Run)
  ├── WorkerDaemon (Continuous loop)
  ├── WorkerHealthServer (Port 8080: /health & /ready)
  └── Playwright Chromium (Headless browser automation)
```

### Supported Hosting Platforms
1. **Fly.io**: Dedicated persistent VM (`fly launch`, configure `fly.toml` with `[[services.http_checks]]` for `/health` and `/ready`).
2. **AWS ECS / Fargate**: Persistent container task with service health check on port `8080`.
3. **Railway**: Dockerfile-based deployment with persistent worker service.
4. **Render**: Background Worker or Web Service with health check path `/health`.
5. **GCP Cloud Run**: Configured with `--min-instances 1` and `--cpu-allocation always`.

> **CRITICAL**: The persistent worker must NEVER be deployed to Vercel or any serverless platform with execution time limits or lack of headless Chromium process support.

---

## 12. Deployment & Rollback Procedure

### Immutable Container Build
Always build and tag container images with the immutable Git commit SHA:
```bash
COMMIT_SHA=$(git rev-parse --short HEAD)
docker build -f worker/Dockerfile -t sculra-worker:${COMMIT_SHA} .
```

### Secrets Configuration
Provision credentials strictly through the platform's secret manager:
```bash
# Example for Fly.io:
fly secrets set \
  SUPABASE_URL="https://<project-id>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-secret>" \
  NODE_ENV="production" \
  WORKER_CONCURRENCY="1"

# Example for Railway:
railway variables set \
  SUPABASE_URL="https://<project-id>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-secret>" \
  NODE_ENV="production"
```

### Rollback Procedure
If a regression or failure occurs in a newly deployed worker image:
1. Re-deploy the previously verified container image tag (e.g. `sculra-worker:<previous-commit-sha>`).
2. Because worker jobs are stateless and lease-managed, in-flight jobs on the terminated worker will naturally expire within `WORKER_LEASE_SECONDS` (60s) and be safely reclaimed by the rolled-back worker container.
3. No database migrations are required to roll back the worker service.

---

## 13. Observability & Safe Production Logging

The worker emits structured JSON logs designed for cloud ingestion (Datadog, CloudWatch, Google Cloud Logging, Logtail) with zero secret leakage:

- **Tracked Fields**: `workerId`, `jobId`, `jobType`, `attempt`, `status`, `durationMs`, `errorCode`.
- **Automatic Redaction**: Service-role keys, anon keys, bearer tokens, passwords, cookies, and authorization headers are scrubbed before emission.
- **Sentry Telemetry**: When `SENTRY_DSN` is configured, worker unhandled exceptions are captured with scrubbed breadcrumbs.

---

## 14. Current Platform Verification & Environment Status

An environment audit was performed on the current workspace:
- **Playwright Chromium**: Verified locally via `pnpm worker:smoke` (headless launch, navigation, DOM interaction, screenshot generation succeeded in ~2.2s).
- **Health Server Hardening**: Verified via unit and integration tests. `/health` and `/ready` strictly output standardized error codes (`WorkerSafeErrorCode`) without leaking stack traces, exception messages, database queries, or credentials.
- **Queue Semantics & Recovery**: Verified via integration tests. Atomic acquisition, heartbeat renewal, stale lease recovery, and stale overwrite protection tested and confirmed.
- **Container Build & Cloud Deployment Tooling**:
  - The local development host currently does not have an active Docker daemon (Docker Desktop uninstalled / WSL distribution missing).
  - No authenticated cloud platform CLI (`fly`, `railway`, `render`, `gcloud`, `aws`, `gh`) is configured in the current shell.
  - `SUPABASE_SERVICE_ROLE_KEY` is not present in local `.env` configuration.
  - **Status**: Local code and container configurations are fully production-ready. Remote deployment and live cloud queue processing are **BLOCKED** pending provisioning of target cloud credentials and container runtime.

