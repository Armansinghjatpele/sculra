# Isolated Feature Modules

This directory contains domain-isolated modules representing Sculra product areas (e.g. `billing`, `projects`, `reports`).

## Rules

Each subfolder corresponds to a self-contained feature and should only contain:
- `components/`: Feature-specific UI elements.
- `hooks/`: Feature-specific hooks.
- `services/`: API routes or state synchronization matching this feature.
- `types/`: Domain models and schemas.
- `utils/`: Inline helpers.

Features must never directly import from other feature directories. Share code through global libraries (`@/shared`, `@/components`, `@/hooks`) to ensure modularity.

