# Sculra API Specification

This document details the REST API specifications and Webhook structures for the backend API of Sculra.

---

## 1. Global Headers & Base URL

- **Base URL**: `https://api.Sculra.io/v1`
- **Request Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <JWT_TOKEN>` (For user authenticated requests)
  - `X-API-Key: <CLIENT_API_KEY>` (For programmatic/CI integration requests)

---

## 2. Authentication Endpoints

Supabase Auth is used directly on the client. The backend API verifies tokens but also implements several auxiliary session management hooks:

### POST `/auth/sync`

Syncs Supabase user profile details to the main Postgres workspace profile upon initial registration.

- **Request Body**:
  ```json
  {
    "userId": "usr_abc123",
    "email": "user@domain.com",
    "name": "Jane Doe"
  }
  ```
- **Response**: `200 OK` (Profile synced).

---

## 3. Projects & Testing Endpoints

### GET `/projects`

Retrieves a list of all active projects the user has access to.

- **Response (`200 OK`)**:
  ```json
  [
    {
      "id": "proj_123",
      "name": "My App Core",
      "url": "https://myapp.com",
      "organizationId": "org_789",
      "createdAt": "2026-08-07T12:00:00Z"
    }
  ]
  ```

### POST `/projects`

Creates a new project.

- **Request Body**:
  ```json
  {
    "name": "My App Core",
    "url": "https://myapp.com",
    "organizationId": "org_789"
  }
  ```
- **Response (`201 Created`)**.

### POST `/projects/:projectId/test-runs`

Triggers an automated QA test run against the configured website or repository url.

- **Request Body**:
  ```json
  {
    "triggerType": "manual", // or "ci", "cron"
    "commitHash": "a1b2c3d4",
    "viewport": { "width": 1280, "height": 720 }
  }
  ```
- **Response (`202 Accepted`)**:
  ```json
  {
    "testRunId": "run_999",
    "status": "queued",
    "createdAt": "2026-08-07T16:00:00Z"
  }
  ```

---

## 4. Webhook Ingestions

### POST `/webhooks/stripe`

Handles Stripe events. Webhook authentication is verified using the Stripe SDK webhook signature (`stripe-signature`).

- **Required Events**:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### POST `/webhooks/github`

Handles GitHub webhook integration events (e.g. PR open, release tag created) to trigger automatic testing workflows.

- **Header**: `X-Hub-Signature-256`
