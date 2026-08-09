# Global Reusable Components Folder

This directory contains pure, generic, reusable UI components.

## Rules

- No page-specific or feature-specific logic.
- Must be stateless or rely purely on standard props.
- Utilize class merges using `cn(...)` from `@/lib/utils` for custom style support.
- Fully support dark-mode styling natively.
