# Feature: Authentication

This module handles auth flows, social logins, and password recoveries.

## File Structure

- `components/`: LoginForm, SignupForm, ResetPasswordForm, AuthLayout.
- `hooks/`: `useAuth`, `useSession`.
- `services/`: Supabase Auth API wrapper methods.
- `types/`: User roles and session state definitions.
- `utils/`: Redirect logic and email validation rules.
