# Sculra Platform Infrastructure Specifications

This document outlines the hosting architecture, background worker pools, monitoring strategies, analytics logging layers, and caching structures for Sculra.

---

## 1. Decoupled Worker Pools (Docker Architecture)

Sculra separates intensive execution grids from API routing logic using Docker container pools (configured in `docker-compose.dev.yml` for dev runs):

- **Playwright Worker (`browser-worker`)**: Spin-up chromium sandboxes. Configured with `ipc: host` and `seccomp:unconfined` to prevent browser crashes during DOM sweeps.
- **AI Inference Worker (`ai-worker`)**: Interacts with OpenAI/Anthropic APIs to evaluate screenshots and run accessibility/UX audits.
- **Background Runner (`background-worker`)**: Listens to Redis-backed message queues to process async reporting workflows.
- **Redis Cache Grid**: Manages job task queues (BullMQ) and handles rate limiting.

---

## 2. Monitoring & Error Tracking (Sentry)

Sculra instruments Sentry across the monorepo to isolate errors and compile latency metrics:

- **Frontend Client**: Tracks React hydration crashes, bundle loading issues, and routing performance.
- **Server APIs**: Captures HTTP status 500s, database connection drops, and validation failures.
- **Queue Workers**: Intercepts browser worker timeouts, Playwright engine crashes, and AI rate-limiting issues.

---

## 3. Analytics Layer (PostHog)

We restrict direct PostHog SDK dependencies using a central singleton wrapper (`frontend/lib/analytics.ts`). This allows us to:
- Toggle tracking on/off dynamically based on environment keys presence.
- Avoid tracking user authentication credentials.
- Handle mock analytics console tracking logs in local developer runs.

---

## 4. Edge Layer & CDN (Cloudflare)

Cloudflare acts as the edge entrypoint layer for the Sculra SaaS platform:

- **DNS & CDN**: Resolves routing records and caches static assets (Next.js scripts, layout components, public CSS files).
- **Web Application Firewall (WAF)**: Scans request payloads to block XSS and malicious bot sweeps.
- **Rate Limiting**: Enforces rate limiting at the Cloudflare Edge layer first to mitigate DDoS attacks before traffic hits our servers.

---

## 5. Application Rate Limiting (Redis)

If application-level rate limits are required (e.g., token-based API key rate limits), we leverage **Redis** to store request counters. 
- *NOTE: Redis is not a mandatory dependency for basic local development. If missing, local dev servers revert to memory-based limits.*
