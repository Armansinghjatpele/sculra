# Middleware Functions

This folder defines request interception pipelines for security, redirects, and session protection.

## Core Middleware Modules

- `auth.ts`: Re-routes unauthenticated users to `/login` and verifies tenant subscription active.
- `security.ts`: Applies secure headers (CSP, X-Frame-Options, STS).
