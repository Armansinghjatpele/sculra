# Contributing to Sculra

This guide specifies git policies, commit standards, and pull request workflows for Sculra.

---

## 1. Branch Naming System

Use the following naming presets for branch creations:
- **Features**: `feat/your-feature-name`
- **Bug Fixes**: `fix/bug-description`
- **Documentation**: `docs/topic-name`
- **Performance**: `perf/optimization`
- **Chore / Configs**: `chore/dependency-updates`

*Example: `feat/saml-sso-okta` or `fix/jwt-expiration-race`.*

---

## 2. Commit Message Structure

Commit messages must satisfy the **Conventional Commits** standard:

```text
<type>(<scope>): <short description>

[optional detailed description body]
```

### Types:
- `feat`: User-facing features.
- `fix`: Runtime/styling bug fixes.
- `docs`: Document modifications.
- `perf`: Load time optimizations.
- `chore`: Packages bumps or CI settings updates.

*Example: `feat(billing): create Stripe checkout session integration`.*

---

## 3. Pull Request Guidelines

1. Install dependencies and compile checks before committing:
   ```bash
   pnpm install
   pnpm typecheck
   ```
2. Verify formatting:
   ```bash
   pnpm format
   ```
3. Open a PR targeting `main` or `staging` branches. The GitHub CI Actions runner must succeed before review assignment.
