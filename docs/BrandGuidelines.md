# Sculra Brand Identity & Visual Guidelines

This document serves as the master specification for **Sculra**'s brand identity, visual language, copywriting, motion design, and developer tools layout guidelines. Every future screen, component, illustration, and message must conform to this specification.

---

## 1. Brand Essence & Personality

Sculra is a professional, developer-first, AI-native software quality platform. It represents confidence, high velocity, and engineering precision.

### Personality Pillars

- **Technical & Confident**: Speaking directly to engineers using clear, logical assertions. No marketing fluff.
- **Minimalist & Clean**: Embracing ample whitespace, light border layouts, and clean typographic grids.
- **Calm & Reliable**: Functioning like a senior developer who undercovers security issues, regression bugs, and accessibility flaws without inducing panic.
- **Strictly Professional**: Never playful, childish, or overly corporate.

---

## 2. Logo System

The Sculra logo represents geometric order, compiler precision, and automated quality scans.

### Concept & Shape Symbolism

- **The Concept**: The logo features the letter **S** combined with a clean, geometric **Checkmark** (representing QA) and an outer **Scanning Reticle** (representing automation).
- ** Favicon**: High-contrast outline version of the checkmark logo, optimized for 16x16 and 32x32 viewports.
- **Logo Animation**:
  - _Interaction_: Draw-in SVG path tracing the reticle outline (duration: 300ms), followed by a soft glass-shimmer highlight across the checkmark face.
- **Clear Space**: The minimum clear space surrounding the logo must be equivalent to `50%` of the width of the logo mark.

---

## 3. Color System

Sculra features a dark-first color palette with sharp, functional colors indicating state and diagnostics details.

### Palette Specifications

| Name            | Hue Range (HSL/HEX)         | Rationale                                                                    |
| --------------- | --------------------------- | ---------------------------------------------------------------------------- |
| **Primary**     | `#2563EB` (blue-600 base)   | Communicates reliability, confidence, and enterprise-grade strength.         |
| **Accent**      | `#00D4FF` (cyan-500 base)   | Represents AI scanning, interactivity highlights, and terminal focal points. |
| **Success**     | `#22C55E` (green-500 base)  | Indicates passed test steps, stable builds, and security verification.       |
| **Warning**     | `#F59E0B` (amber-500 base)  | Highlights warning logs, accessibility issues, or minor DOM flaws.           |
| **Danger**      | `#EF4444` (red-500 base)    | Represents critical errors, runtime page crashes, or validation failures.    |
| **Information** | `#8B5CF6` (violet-500 base) | Indicates network metrics info, system updates, and tips.                    |

### Color Ranges (100 - 900)

```text
Neutral (Zinc-slate premium dark surface base):
- 100: #F4F4F5 | 200: #E4E4E7 | 300: #D4D4D8 | 400: #A1A1AA
- 500: #71717A | 600: #52525B | 700: #3F3F46 | 800: #27272A
- 900: #18181B | 950: #09090B | Background: #030303

Primary Blue:
- 100: #EFF6FF | 200: #DBEAFE | 300: #BFDBFE | 400: #93C5FD
- 500: #60A5FA | 600: #2563EB | 700: #1D4ED8 | 800: #1E40AF | 900: #1E3A8A

Accent Cyan:
- 100: #E6FCFF | 200: #B3F7FF | 300: #80F1FF | 400: #4DEBFF
- 500: #00D4FF | 600: #00B3D9 | 700: #008CA6 | 800: #006473 | 900: #003B40
```

---

## 4. Typography

Sculra uses **Geist** for sans-serif UI elements and **Geist Mono** for code overlays, ensuring readability and developer-first aesthetics.

### Typography Scale

- **Display XL**: `3.75rem / 60px` | Line height: `1.1` | Letter spacing: `-0.02em` | Weight: SemiBold (700)
- **Heading 1**: `2.25rem / 36px` | Line height: `1.25` | Letter spacing: `-0.01em` | Weight: Bold (700)
- **Heading 2**: `1.875rem / 30px` | Line height: `1.3` | Letter spacing: `-0.01em` | Weight: SemiBold (600)
- **Heading 3**: `1.5rem / 24px` | Line height: `1.35` | Letter spacing: `normal` | Weight: SemiBold (600)
- **Body Large**: `1.125rem / 18px` | Line height: `1.5` | Letter spacing: `normal` | Weight: Regular (400)
- **Body (Base)**: `0.875rem / 14px` | Line height: `1.5` | Letter spacing: `normal` | Weight: Regular (400)
- **Code**: `0.8125rem / 13px` | Line-height: `1.6` | Letter spacing: `normal` | Weight: Medium (500)
- **Label / Button**: `0.875rem / 14px` | Line-height: `1` | Weight: Medium (500)
- **Caption**: `0.75rem / 12px` | Line-height: `1.4` | Weight: Regular (400)

---

## 5. Iconography (Lucide System)

Icons must follow a strict, unified visual layout:

- **Stroke Width**: `1.75px` (light, premium lines).
- **Corner Radius**: `0.5px` to `1px` (slight rounding, avoiding round/childish bubble look).
- **Consistency**: Keep icon scales uniform (typically `16px / 1rem` for buttons/tabs; `20px` for headers).

---

## 6. Illustration & Photography Styles

### Custom Illustration Style

- **No Stock Graphics**: Strictly forbid cartoon office vectors or generic 3D shapes.
- **Visual Direction**:
  - Abstract node charts detailing API interactions.
  - Wireframe overlays with scanning cyan indicators.
  - Blueprint grids showcasing visual alignment tolerances.
  - Minimal line drawings showcasing developer workspaces and code blocks.

### Photography Direction (If Used)

- High contrast, dark themes.
- Clean development setups, close-ups of monitors, and code viewports.
- No forced, smiling stock office group poses.

---

## 7. Motion Language (Animation Guidelines)

Motion must feel responsive, clean, and fast.

- **Hover States**: Short scaling and outline shimmers (`100ms`).
- **Transitions (Fade / Slide)**: `200ms` using `cubic-bezier(0.16, 1, 0.3, 1)`.
- **AI Thinking / Scanning**: A subtle, slow-pulse back-glow (`2000ms` infinite loop) combined with an accent colored scanning line moving down the code panel layout.
- **A11y**: Always support `@media (prefers-reduced-motion: reduce)` rules by rendering static layouts when triggered.

---

## 8. Layout & Shapes (Visual Architecture)

- **Grid Spacing**: Built on the 8px grid (all padding, gaps, and elements margins align to multiples of 8).
- **Borders**: Thin (`1px`), low opacity borders (`border: 1px solid rgba(255, 255, 255, 0.08)`).
- **Card Radius**: `8px` (rounded-md). Avoid round configurations.
- **Glassmorphic Panels**: Thin white border overlay, backdrop blur (`12px`), dark tint bg (`rgba(10, 10, 10, 0.45)`).

---

## 9. Copywriting, Voice & Tone Guide

### The Sculra Voice

Sculra writes like a peer developer: technical, direct, clear, and confident.

- **Assertive & Value-Driven**: Explain what happened immediately.
- **No Buzzwords**: Do not say "next-generation synergized AI". Say "automated test execution".

### Copywriting Examples

| Context            | Preferred (Do Use)                                                            | Avoid (Do Not Use)                                               |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Buttons**        | `Start Testing`, `Run Analysis`, `View Report`                                | `Click Here`, `Submit`, `Proceed`                                |
| **Hero Text**      | `Release with certainty.`, `Know what is broken.`                             | `Revolutionary AI platform for maximum synergy.`                 |
| **Error Messages** | `Connection failed: Port 5432 timed out. Verify your database is accessible.` | `Error 500: An unexpected error occurred. Please contact admin.` |
| **Empty States**   | `No tests executed yet. Connect a target URL to start scanning.`              | `It looks quiet here! Try launching your first test.`            |

---

## 10. AI Personality

The AI analyzer inside Sculra acts as a **Senior Staff QA Engineer**:

- **Analytical**: Backs up every diagnostic recommendation with runtime trace logs or DOM nodes.
- **Calm & Helpful**: Focuses on explaining the problem, the regression cause, and the exact code/CSS fix.
- **Objective**: Does not use exclamation marks or apologetic phrases.

---

## 11. Sound Design (Future Direction)

- Soft, high-frequency, clean confirmation notes.
- Low-end deep tones for system errors.
- Never use arcade, gaming, or high-pitched alert sound effects.

---

## 12. Asset Organization & Structure

All brand assets must reside in structured root directories:

- `assets/logo/`: Logo marks, favicon, app icon, monochrome/outline SVG files.
- `assets/banners/`: OG/social cards.
- `assets/templates/`: Email templates, slide presentations.
