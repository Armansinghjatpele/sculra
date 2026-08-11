# Sculra Environment Variables Reference

This document describes all environment variables used by the Sculra system, their purpose, default values, and how they should be configured.

---

## 1. Required Variables (For Local Dev & Bootstrapping)

These variables must be populated to run the basic application. If any are missing, the env validation checks will trigger a fail-fast crash on startup.

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `NODE_ENV` | Run mode context. | `development` / `production` | Yes |
| `NEXT_PUBLIC_APP_URL` | Root URL of frontend client. | `http://localhost:3000` | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public publishable token to load Clerk SDK. | `pk_test_...` | Yes |
| `CLERK_SECRET_KEY` | Clerk backend API authentication key. | `sk_test_...` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API endpoint host URL. | `https://x.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public access key safe for browser use. | `eyJhbGciOi...` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | High-privilege API key (Bypasses RLS). | `eyJhbGciOi...` | Yes (Backend only) |

---

## 2. Optional Variables (For Local Feature-Gating)

These variables enable auxiliary features (analytics, payments, AI checks) locally. If omitted, Sculra will boot normally but warn that these services are disabled.

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `CLERK_WEBHOOK_SECRET` | Secret to sign Clerk webhooks (triggers db synchronization). | `whsec_...` | Yes |
| `NEXT_PUBLIC_POSTHOG_KEY` | Client-side identifier for analytics tracking. | `phc_your_key` | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog API tracking server destination. | `https://us.i.posthog.com` | Yes |
| `NEXT_PUBLIC_SENTRY_DSN` | Destination URL for sentry error tracking reports. | `https://sentry.io/1` | Yes |
| `SENTRY_AUTH_TOKEN` | Auth token used to upload source maps. | `sntry_token_x` | Yes (CI/CD only) |
| `OPENAI_API_KEY` | API Key for OpenAI GPT-4o model integrations. | `sk-proj-...` | Yes |
| `ANTHROPIC_API_KEY` | API Key for Anthropic Claude model integrations. | `sk-ant-...` | Yes |
| `GOOGLE_AI_API_KEY` | API Key for Google Gemini model integrations. | `AIzaSy...` | Yes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser token to launch Stripe checkout. | `pk_test_...` | Yes |
| `STRIPE_SECRET_KEY` | Stripe backend REST client API Key. | `sk_test_...` | Yes |
| `STRIPE_WEBHOOK_SECRET` | Secret key used to verify incoming webhook payloads. | `whsec_...` | Yes |

---

## 3. Future Scaling Variables

These variables are defined for future distributed scaling and edge caching. They are not required for standard local developer runs.

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `REDIS_URL` | Endpoint host URL for distributed caching/queues. | `redis://...` | Yes |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account tag for WAF API routing. | `your_account_id` | Yes |
| `CLOUDFLARE_API_TOKEN` | Cloudflare token for security headers configuration. | `your_api_token` | Yes |
