# Sculra Enterprise Design System Documentation

This document describes the design token systems, typography guidelines, component variants, and accessibility notes used across the Sculra codebase.

---

## 1. Design Token System

Design tokens are mapped directly to CSS variables inside [`globals.css`](file:///c:/Users/arman/OneDrive/Desktop/sculra/frontend/app/globals.css) and compiled into the Tailwind v4 engine.

### 1.1 Color Palette System

Every core brand and semantic color is mapped in a 100-900 scale:

- **Neutral**: Zinc-based dark neutrals (`--neutral-50` to `--neutral-950`).
- **Primary**: Deep electric blue (`--primary-100` to `--primary-900`; Base 600: `#2563EB`).
- **Accent**: Cyber neon cyan (`--accent-100` to `--accent-900`; Base 500: `#00D4FF`).
- **Success**: Vibrant green (`--success-100` to `--success-900`; Base 500: `#22C55E`).
- **Warning**: Warm amber (`--warning-100` to `--warning-900`; Base 500: `#F59E0B`).
- **Danger**: Critical red (`--danger-100` to `--danger-900`; Base 500: `#EF4444`).
- **Information**: Soft purple (`--info-100` to `--info-900`; Base 500: `#8B5CF6`).

### 1.2 Spacing Grid (8px Base)

Standard margins and paddings align to the 8px grid tokens:

- `--space-2` (2px), `--space-4` (4px), `--space-8` (8px), `--space-12` (12px), `--space-16` (16px), `--space-20` (20px), `--space-24` (24px), `--space-32` (32px), `--space-40` (40px), `--space-48` (48px), `--space-56` (56px), `--space-64` (64px), `--space-80` (80px), `--space-96` (96px), `--space-128` (128px).

### 1.3 Border Radius Scale

- `xs` (2px), `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `2xl` (24px), `full` (9999px).

### 1.4 Elevations & Shadows

- `xs`, `sm`, `md`, `lg`, `xl`, `2xl`.
- `glass`: Custom shadow configuration combined with `backdrop-filter: blur(12px)` for glassmorphism layout cards.
- `floating-card`: High elevation blur for popovers, command menus, and dialog boards.

### 1.5 Motion Curves

- `Very Fast` (100ms), `Fast` (200ms), `Normal` (300ms), `Slow` (500ms), `Very Slow` (800ms).
- All transit using easing curve: `cubic-bezier(0.16, 1, 0.3, 1)`.

---

## 2. Component Variant Blueprint (Storybook Ready)

### 2.1 Button

- **Component**: [`Button`](file:///c:/Users/arman/OneDrive/Desktop/sculra/frontend/components/Button.tsx)
- **Props**:
  - `variant`: `default` | `secondary` | `outline` | `ghost` | `destructive` | `success` | `accent` | `link`
  - `size`: `default` | `sm` | `lg` | `icon`
  - `asChild`?: boolean
- **A11y Notes**: Built using composable Radix Slot. Support keyboard focus visible rings.

### 2.2 Glass Card

- **Component**: [`Card`](file:///c:/Users/arman/OneDrive/Desktop/sculra/frontend/components/Card.tsx)
- **Props**:
  - Standard HTML div attributes.
- **A11y Notes**: Incorporates semantic heading targets for content reader accessibility.

### 2.3 Drawer Panel

- **Component**: [`Drawer`](file:///c:/Users/arman/OneDrive/Desktop/sculra/frontend/components/Drawer.tsx)
- **Props**:
  - `isOpen`: boolean
  - `onClose`: () => void
  - `side`: `left` | `right`
  - `title`?: string

---

## 3. UI & Accessibility Guidelines

- **Focus Ring Indicators**: Interactive controls must leverage the `.focus-ring-visible` class to assert distinct outlines when navigated via keyboard.
- **Reduced Motion Support**: `@media (prefers-reduced-motion: reduce)` automatically disables spring and transition keyframes globally.
- **WCAG AA Compliance**: High-contrast ratios are enforced. Muted text fields leverage neutral gray scales ensuring readability against deep dark backgrounds.
