# Sculra AI QA Orchestration Architecture

This document describes the architectural foundation for Sculra's **Provider-Agnostic AI QA Engineer**.

> **CRITICAL ARCHITECTURAL GUARANTEE**:
> **The AI NEVER directly controls Playwright.** The AI operates strictly as a structured planner and reasoner that produces a typed, validatable plan (`AIQAPlan`). The existing deterministic `JourneyExecutor` remains the sole browser actuator.

---

## 1. System Architecture Pipeline

```mermaid
flowchart TD
    AppMap[Application Map & Discovered Pages] --> CtxBuilder[AI QA Context Builder]
    PrevJourneys[Previous Journey Traces & Results] --> CtxBuilder
    ExistingBugs[Deterministic Issues & Observations] --> CtxBuilder
    VisualQA[Visual & Responsive Observations] --> CtxBuilder
    
    subgraph Sanitization [Context Defense & Redaction]
        CtxBuilder --> Sanitizer[AIQAContextSanitizer]
        Sanitizer -- "Treats all DOM text as Untrusted Data" --> Ctx[Sanitized AIQAContext]
        Sanitizer -- "Redacts JWTs, Keys, Passwords" --> Ctx
        Sanitizer -- "Quarantines Prompt Injections" --> Ctx
    end
    
    subgraph PlanningLoop [Bounded AI QA Loop]
        Ctx --> Provider[AIQAProvider: Mock / Future Provider]
        Provider --> RawPlan[Structured AIQAPlan]
        
        RawPlan --> Validator[AIQASafetyValidator]
        Validator -- "Schema Validation" --> Validated{Safety Check}
        Validator -- "Dangerous Action Filter" --> Validated
        Validator -- "SSRF & Scope Check" --> Validated
        Validator -- "Sensitive Field Filter" --> Validated
        
        Validated -- "All Rejected or Stop Condition" --> StopReason[Stop Loop]
        Validated -- "Approved Actions" --> JourneyConv[Convert to Deterministic Journey]
    end
    
    subgraph Actuation [Deterministic Actuation Only]
        JourneyConv --> JourneyExec[Deterministic JourneyExecutor]
        JourneyExec --> Playwright[Playwright Browser]
        Playwright --> Telemetry[Step Telemetry & Observations]
    end
    
    Telemetry --> IssueAssessment[Categorize: CONFIRMED vs SUSPECTED]
    IssueAssessment --> DBStorage[(Supabase test_evidence & issues)]
    Telemetry -- "Observations for Iteration N+1" --> CtxBuilder
```

---

## 2. Core Architectural Principles

1. **Provider-Agnostic Design**:
   The engine interacts with AI providers strictly through the `AIQAProvider` interface. The rest of the QA engine does not depend on any specific LLM provider or SDK.
2. **Deterministic Execution Boundary**:
   The AI can only select actions from an allowlisted vocabulary (`NAVIGATE`, `CLICK`, `FILL`, `SELECT`, `CHECK`, `UNCHECK`, `PRESS`, `WAIT_FOR_NAVIGATION`, `ASSERT_VISIBLE`, `ASSERT_URL`, `ASSERT_TITLE`, `VALIDATE_FORM`). It cannot emit executable JavaScript or arbitrary Playwright scripts.
3. **Multi-Layer Safety Validation**:
   Every plan is evaluated by `AIQASafetyValidator` before actuation. Unsafe actions (deletion, checkout/payment, logout, authentication changes, sensitive credentials, cross-origin navigations, SSRF) are rejected with structured rejection reasons.
4. **Prompt Injection Defense**:
   All browser-derived text (titles, labels, buttons, DOM text, error messages) is treated as **untrusted data**. Malicious instructions embedded in web pages are quarantined and cannot override system instructions or safety rules.
5. **Bounded Budgets & Deterministic Termination**:
   Configurable budgets (`MAX_AI_ITERATIONS = 3`, `MAX_AI_CALLS = 5`, `MAX_TOTAL_ACTIONS = 30`, `MAX_AI_TIME_MS = 60000`) guarantee that the loop terminates deterministically without infinite recursion or runaway costs.
6. **Authoritative Evidence & Issue Deduplication**:
   Deterministic SHA-256 fingerprinting remains authoritative. AI-derived issues are categorized as `CONFIRMED` (directly backed by step/observation failure) or `SUSPECTED` (hypothesis requiring further testing).

---

## 3. Provider Abstraction (`AIQAProvider`)

```typescript
export interface AIQAProviderMetadata {
  name: string;
  model: string;
  isDeterministicMock: boolean;
}

export interface AIQAProvider {
  readonly metadata: AIQAProviderMetadata;
  generatePlan(
    context: AIQAContext,
    cancellationToken?: CancellationToken
  ): Promise<AIQAPlan>;
}
```

---

## 4. Structured AI QA Plan Schema (`AIQAPlan`)

```typescript
export interface AIQAPlan {
  version: '1.0';
  planId: string;
  iteration: number;
  reasoningSummary: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  hypotheses: AIQAHypothesis[];
  actions: AIQAAction[];
  expectedOutcomes: AIQAExpectation[];
  stopConditions: AIQAStopCondition[];
}
```

---

## 5. Security & Safety Rules

| Check | Action Taken | Reason |
| :--- | :--- | :--- |
| **Dangerous Action** (`delete`, `checkout`, `logout`, etc.) | **Rejected** (`DANGEROUS_ACTION`) | Prevents destructive side-effects on target systems. |
| **Sensitive Field** (`password`, `credit_card`, `ssn`, etc.) | **Rejected** (`SENSITIVE_FIELD`) | Protects credentials and prevents credential exfiltration. |
| **Cross-Origin Navigation** | **Rejected** (`CROSS_ORIGIN`) | Confines testing strictly to target application scope. |
| **SSRF / Internal IP Range** | **Rejected** (`SSRF_SECURITY_VIOLATION`) | Prevents internal network and cloud metadata access. |
| **Unallowlisted Action** | **Rejected** (`UNALLOWLISTED_ACTION`) | Enforces strictly typed action vocabulary. |
| **Prompt Injection Payload** | **Quarantined** as untrusted string | Neutralizes instructions embedded in DOM text. |

---

## 6. Production Hardening & Service Role Enforcement

In production mode (`NODE_ENV === 'production'`), the background worker (`WorkerDaemon` and `JobExecutor`) strictly requires `SUPABASE_SERVICE_ROLE_KEY` and will fail fast on startup if missing. It does not fall back to anon keys in production.
