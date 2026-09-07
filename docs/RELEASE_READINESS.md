# Sculra AI Release Readiness & QA Intelligence Engine

This document details the **Release Readiness & QA Intelligence Engine** (Scoring Version: `1.0`), which calculates authoritative, deterministic release readiness assessments, category scores, blockers, confidence levels, and structured AI risk explanations across test runs in Sculra.

---

## 1. Architectural Principles

1. **Deterministic Authority**:
   - Numeric release scores (0–100), category scores, release blockers, and evidence confidence levels are computed **purely deterministically** from collected facts and telemetry.
   - The AI / LLM is an **explainer and risk synthesizer only**. It **NEVER** overrides numeric scores, blockers, or deterministic facts.

2. **No "Fake 100s" Guarantee**:
   - A test run with sparse evidence, skipped journeys, zero pages tested, or untested viewports cannot produce a misleading 100/100 score.
   - Confidence levels (`HIGH`, `MEDIUM`, `LOW`, `INSUFFICIENT`) and release recommendations explicitly reflect test depth and evidence quality.

3. **Multi-Category Coverage**:
   - Release readiness incorporates functional correctness, visual stability, responsive cross-device layout, execution reliability, and discovery/coverage completeness into weighted sub-scores.

---

## 2. Release Scoring Mathematical Model (`v1.0`)

The overall release score is calculated as a weighted composite of 5 category scores, rounded to the nearest integer in `[0, 100]`:

$$\text{OverallScore} = \text{round}\left( 0.35 \cdot S_{\text{func}} + 0.20 \cdot S_{\text{vis}} + 0.20 \cdot S_{\text{resp}} + 0.10 \cdot S_{\text{rel}} + 0.15 \cdot S_{\text{cov}} \right)$$

| Category | Weight | Base Score | Key Deductions / Factors |
|---|---|---|---|
| **Functional** ($S_{\text{func}}$) | **35%** | 100 | - Failed user journeys: `-25` pts per failed journey<br>- Critical functional bugs: `-30` pts per bug<br>- High functional bugs: `-15` pts per bug<br>- Medium functional bugs: `-5` pts per bug<br>- Low functional bugs: `-2` pts per bug<br>- Journey action failure rate penalty (up to `-20` pts) |
| **Visual** ($S_{\text{vis}}$) | **20%** | 100 | - High visual regressions: `-20` pts per bug<br>- Medium visual regressions: `-8` pts per bug<br>- Low visual regressions: `-3` pts per bug<br>- Visual regression failure rate penalty (up to `-30` pts)<br>*(Note: `BASELINE_MISSING` is recorded as baseline establishment with 0 pt penalty)* |
| **Responsive** ($S_{\text{resp}}$) | **20%** | 100 | - High responsive layout bugs (horizontal overflow, overlapping elements, touch target violation, clipped text): `-15` pts per bug<br>- Medium responsive bugs: `-6` pts per bug<br>- Low responsive bugs: `-2` pts per bug<br>- Missing viewport penalty (Desktop, Tablet, Mobile): `-25` pts per untested target viewport |
| **Reliability** ($S_{\text{rel}}$) | **10%** | 100 | - Unhandled runtime console errors: `-10` pts per unique error message (capped at `-40`)<br>- HTTP 5xx server errors: `-15` pts per unique endpoint (capped at `-45`)<br>- HTTP 4xx client errors on critical paths: `-5` pts per unique endpoint (capped at `-20`)<br>- Worker/execution cancellations or unhandled timeouts: `-30` pts |
| **Coverage** ($S_{\text{cov}}$) | **15%** | 100 | - Discovered page journey coverage: $( \text{TestedPages} / \text{DiscoveredPages} ) \cdot 60$<br>- Target viewport coverage: $( \text{TestedViewports} / 3 ) \cdot 40$ |

All sub-scores are bounded in the range $[0, 100]$.

---

## 3. Release Recommendation & Risk Levels

### Release Recommendations
- **`RELEASE`**:
  - `OverallScore >= 85`
  - `BlockersCount === 0`
  - `Confidence in ['HIGH', 'MEDIUM']`
- **`RELEASE_WITH_CAUTION`**:
  - `OverallScore >= 65` and `OverallScore < 85`
  - `BlockersCount === 0`
  - `Confidence in ['HIGH', 'MEDIUM']`
- **`DO_NOT_RELEASE`**:
  - `OverallScore < 65` OR `BlockersCount > 0`
- **`INSUFFICIENT_EVIDENCE`**:
  - Zero pages discovered/tested OR zero journeys attempted OR `Confidence === 'INSUFFICIENT'`

### Risk Levels
- **`CRITICAL`**: `BlockersCount > 0` OR `OverallScore < 40`
- **`HIGH`**: `OverallScore < 65` OR critical/high bug count $\ge 2$
- **`MEDIUM`**: `OverallScore < 85` OR any medium functional/visual bug
- **`LOW`**: `OverallScore >= 85` AND zero blockers AND zero critical/high bugs
- **`UNKNOWN`**: Insufficient evidence to assess risk

### Evidence Confidence
- **`HIGH`**: $\ge 3$ pages tested, all 3 viewports (desktop, tablet, mobile) tested, $\ge 2$ journeys completed, zero unhandled worker errors.
- **`MEDIUM`**: At least 1 page tested, at least 1 viewport tested, at least 1 journey completed.
- **`LOW`**: Sparse test run (e.g. 1 page only, no responsive viewports, or multiple test execution failures).
- **`INSUFFICIENT`**: No journeys run, 0 pages discovered, or run aborted before execution.

---

## 4. Release Blockers Engine

The deterministic scorer inspects all test run artifacts and flags critical release blockers:

1. **Critical/High Severity Functional Bugs**:
   - Form submission crashes, authentication flow failures, 500 server error cascades.
2. **Primary CTA / Navigation Failures**:
   - Navigation journeys marked as failed on root or main conversion routes.
3. **Severe Mobile Layout Collapse**:
   - Critical responsive layout overlapping or unclickable navigation on mobile viewports.
4. **Widespread Server Errors**:
   - Multiple HTTP 5xx responses during journey execution.

Each blocker includes:
- `id`: Unique identifier
- `title`: Short descriptive title
- `description`: Detailed explanation of the failure
- `severity`: `CRITICAL` or `HIGH`
- `category`: `functional`, `visual`, `responsive`, `reliability`, or `coverage`
- `remediation`: Concrete actionable steps for engineering/product teams to fix before release
- `relatedIssueId`: Optional foreign key to `public.issues`

---

## 5. AI Risk Analysis Layer (`AIReleaseAnalysis`)

When configured with an AI provider (`OpenAIQAProvider` or `MockAIQAProvider`), the engine runs structured release analysis with strict JSON schema validation.

### Schema Structure
- **`executiveSummary`**: High-level release risk narrative.
- **`keyRisks`**: Top critical/high risk observations across user experience, brand, and operations.
- **`impactedUserJourneys`**: List of affected workflows (e.g. checkout, login, navigation) with severity and user impact descriptions.
- **`confidenceAssessment`**: Explanation of why the evidence is high, medium, or low confidence.
- **`regressionRisk`**: Qualitative assessment (`LOW`, `MEDIUM`, `HIGH`, `UNKNOWN`) and explanation.
- **`deploymentAdvice`**: Recommended release strategy (e.g. immediate rollback, staged rollout, canary deploy, block release).
- **`suggestedQAExpansions`**: Recommended QA journeys or viewports to test in subsequent runs.

---

## 6. Database Storage & Evidence Artifacts

### `public.release_scores` Table
Stores authoritative scoring snapshots per test run:
- `id`: UUID primary key
- `test_run_id`: Foreign key to `test_runs(id)`
- `project_id`: Foreign key to `projects(id)`
- `overall_score`: Integer (0–100)
- `functional_score`, `visual_score`, `responsive_score`, `reliability_score`, `coverage_score`: Category scores
- `recommendation`: `RELEASE` | `RELEASE_WITH_CAUTION` | `DO_NOT_RELEASE` | `INSUFFICIENT_EVIDENCE`
- `risk_level`: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `UNKNOWN`
- `confidence_level`: `HIGH` | `MEDIUM` | `LOW` | `INSUFFICIENT`
- `scoring_version`: Text (e.g. `"1.0"`)
- `blockers_count`: Integer
- `breakdown`: JSONB details of deductions and components
- `blockers`: JSONB array of `ReleaseBlocker` objects
- `ai_analysis`: JSONB of structured AI risk analysis
- `metadata`: JSONB historical delta comparison and execution stats

### `public.test_evidence` (Type: `release_report`)
Every test run generates a comprehensive 16-section Markdown release report persisted to `test_evidence` with `type = 'release_report'`.

---

## 7. Frontend Release Dashboard (`/release-readiness`)

The frontend provides an interactive, accessible dashboard:
- **Score Dial & Status Badges**: Displays composite score, recommendation badge, risk level badge, and confidence badge.
- **Category Progress Bars**: 5 sub-score meters with deduction count indicators.
- **Release Blockers Panel**: Critical failure callouts with remediation advice and issue links.
- **Score Deduction Breakdown**: Expandable inspector showing exact point deductions per category with reasons.
- **AI Intelligence & Risk Analysis**: Tabbed interface covering Executive Summary, Key Risks, Impacted Journeys, Deployment Advice, and QA Expansions.
- **Coverage & Test Depth Matrix**: Tested pages vs discovered pages, viewports tested, and journey pass rates.
- **Historical Comparison**: Score delta and risk trajectory compared to the previous test run.
