# Sculra Browser Engine Architecture

This module abstracts the browser automation layers using Playwright/Puppeteer. It coordinates screenshot uploads, viewport adjustments, network request tracking, and DOM crawls.

## Subdirectories

- `page-discovery/`: Crawls the page DOM to build a dynamic sitemap.
- `navigation/`: Handles browser page redirects and back/forward loops.
- `workflow/`: Executes sequential script actions.
- `forms/`: Locates text input forms and fills values.
- `buttons/`: Clicks elements safely.
- `screenshots/`: Captures images and uploads to Supabase screenshots bucket.
- `viewport/`: Simulates mobile/desktop sizing breakpoints.
- `console/`: Listens to browser log outputs and tracks errors.
- `network/`: Monitors HTTP request states and API failures.
- `video/`: Records testing traces as MP4 streams.

