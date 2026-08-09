# Sculra Coding Standards

This document outlines the coding standards, patterns, and style guidelines that must be enforced throughout the Sculra repository.

---

## 1. Core Principles

- **Zero "any"**: TypeScript configuration has `noImplicitAny: true` and `strict: true`. Avoid type assertions (`as Type`) unless parsing raw incoming API payloads.
- **Composition over Inheritance**: React components and backend services should use composition patterns.
- **No Hardcoded Values**: Every configuration setting, API endpoint, routing path, feature flag, or limit must be externalized via `config/`, `.env`, or a central `constants` file.
- **Strict Separation of Concerns**: Controllers parse request schemas; Services implement business logic; Repositories query database layers. Components handle layout/interactions; Features isolate domains.

---

## 2. Frontend Guidelines (React & Next.js)

### 2.1 Component Structure
All React components must be functional components and use clean, semantic tags. 

- Use absolute imports: `@/components/Button` instead of `../../components/Button`.
- Keep component files single-focused. If a subcomponent is only used in a parent, locate it in a subdirectory, e.g., `features/projects/components/card/item.tsx`.
- Component props must always be explicitly typed. Prefer `interface Props {}` over `type Props = {}`.

### 2.2 Client vs. Server Components
- Default to **React Server Components (RSC)**.
- Use `"use client"` only when incorporating hooks (`useState`, `useEffect`, `useContext`), custom state, event listeners, or Framer Motion animations.
- Minimize Client Component boundaries to optimize SEO and loading times.

---

## 3. Backend & API Guidelines

### 3.1 DTOs and Validation
- All incoming requests must be validated at the route boundary using schemas (e.g. Zod).
- Controllers must catch errors and delegate to global error handlers. Avoid wrapping every controller method in redundant `try-catch` blocks; use wrapper utilities like `express-async-errors`.

### 3.2 Database Queries
- Repositories should handle Supabase Client queries. Avoid running direct client queries in the middle of Controllers.
- All database columns, functions, and views must be written in `lowercase_snake_case`.

---

## 4. ESLint & Prettier
To maintain consistent formatting:
- Indentation: 2 spaces.
- Semicolons: Enabled.
- Quotes: Single quotes for JavaScript/TypeScript, double quotes for JSX/HTML.
- Trailing commas: Configured to `"all"`.

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100
}
```

