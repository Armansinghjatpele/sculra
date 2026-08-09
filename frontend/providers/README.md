# Application Providers

This directory houses React Context providers wrapping the global root structure.

## Core Providers

- `ThemeProvider`: Houses CSS variables for dark-first styling and theme triggers.
- `AuthProvider`: Coordinates session hooks from Supabase Auth client.
- `PostHogProvider`: Initialized client-side web analytics tracing.
- `SentryErrorBoundary`: Global React error boundary capturing crashes.
