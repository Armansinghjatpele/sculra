# Sculra Environment Variables Reference

This document describes all environment variables used by the Sculra system, their purpose, default values, and how they should be configured in various deployment environments.

---

## 1. App Environment Configuration

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `NODE_ENV` | Mode the server runs in. | `development` / `production` | Yes |
| `NEXT_PUBLIC_APP_URL` | Root URL of the frontend UI for redirect validation. | `http://localhost:3000` | Yes |

---

## 2. Supabase Settings

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase projects API host. | `https://x.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public access key safe for browser use. | `eyJhbGciOi...` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | High-privilege API key (Bypass RLS). | `eyJhbGciOi...` | Yes (Backend only) |

---

## 3. Analytics & Logging (PostHog & Sentry)

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Client-side identifier for analytics tracking. | `phc_your_key` | Yes |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog API tracking server destination. | `https://us.i.posthog.com` | Yes |
| `NEXT_PUBLIC_SENTRY_DSN` | Destination URL for sentry error tracking reports. | `https://sentry.io/1` | Yes |
| `SENTRY_AUTH_TOKEN` | Auth token used to upload source maps. | `sntry_token_x` | Yes (CI/CD only) |

---

## 4. AI & Integration Services

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `OPENAI_API_KEY` | API Key for OpenAI GPT-4o model integrations. | `sk-proj-...` | Yes |
| `ANTHROPIC_API_KEY` | API Key for Anthropic Claude model integrations. | `sk-ant-...` | Yes |
| `GITHUB_CLIENT_ID` | OAuth Client ID for authenticating users via GitHub. | `Iv1.abcdef...` | Yes |
| `GITHUB_CLIENT_SECRET` | OAuth Client Secret matching GITHUB_CLIENT_ID. | `abcdef123...` | Yes |

---

## 5. Payments (Stripe)

| Variable Name | Purpose | Example / Default | Required in Production |
|---|---|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser token to launch Stripe checkout. | `pk_live_...` | Yes |
| `STRIPE_SECRET_KEY` | Stripe backend REST client API Key. | `sk_live_...` | Yes |
| `STRIPE_WEBHOOK_SECRET` | Secret key used to verify incoming webhook payloads. | `whsec_...` | Yes |

---

## 6. Local Setup Instructions

1. Copy the root `.env.example` file to your respective project folder:
   - For frontend: `cp .env.example frontend/.env.local`
   - For backend: `cp .env.example backend/.env`
2. Update the credentials using your personal keys from Supabase dashboard, PostHog, Sentry, Stripe Developer Portal, and GitHub Developer settings.

