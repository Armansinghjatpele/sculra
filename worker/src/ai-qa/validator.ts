// ==============================================================================
// Sculra Strict AI QA Safety Validator (worker/src/ai-qa/validator.ts)
// ==============================================================================
// Enforces strict multi-layer safety policies on all AI-generated plans:
// schema validation, action allowlisting, SSRF/scope containment,
// dangerous action blocking, sensitive field protection, and budget bounding.

import {
  AIQAPlan,
  AIQAAction,
  AIQAValidationResult,
  ActionRejectionReason,
} from './types';
import { JourneyActionType } from '../journeys/types';
import { isDangerousAction, isSensitiveField } from '../journeys/safety';
import { validateTargetUrl } from '../security/ssrf';

const ALLOWED_ACTION_TYPES: JourneyActionType[] = [
  'NAVIGATE',
  'CLICK',
  'FILL',
  'SELECT',
  'CHECK',
  'UNCHECK',
  'PRESS',
  'WAIT_FOR_NAVIGATION',
  'ASSERT_VISIBLE',
  'ASSERT_URL',
  'ASSERT_TITLE',
  'VALIDATE_FORM',
];

export interface ValidatorOptions {
  scopeOrigin: string;
  allowLocalhost?: boolean;
  maxActionsPerJourney?: number;
}

export class AIQASafetyValidator {
  private scopeOrigin: string;
  private allowLocalhost: boolean;
  private maxActionsPerJourney: number;

  constructor(options: ValidatorOptions) {
    this.scopeOrigin = options.scopeOrigin;
    this.allowLocalhost = options.allowLocalhost ?? false;
    this.maxActionsPerJourney = options.maxActionsPerJourney || 15;
  }

  /**
   * Validates and sanitizes an AIQAPlan against strict safety, SSRF, and domain rules.
   */
  validatePlan(plan: AIQAPlan): AIQAValidationResult {
    const validationErrors: string[] = [];
    const approvedActions: AIQAAction[] = [];
    const rejectedActions: ActionRejectionReason[] = [];

    // 1. Schema / Structural Validation
    if (!plan) {
      return {
        approved: false,
        sanitizedPlan: plan,
        approvedActions: [],
        rejectedActions: [],
        validationErrors: ['Plan object is null or undefined.'],
      };
    }

    if (plan.version !== '1.0') {
      validationErrors.push(`Unsupported plan version: "${plan.version}". Expected "1.0".`);
    }

    if (!plan.planId || typeof plan.planId !== 'string') {
      validationErrors.push('Plan must contain a non-empty string "planId".');
    }

    if (!Array.isArray(plan.actions)) {
      validationErrors.push('Plan "actions" must be an array.');
      return {
        approved: false,
        sanitizedPlan: plan,
        approvedActions: [],
        rejectedActions: [],
        validationErrors,
      };
    }

    // 2. Action Count Bounding
    if (plan.actions.length > this.maxActionsPerJourney) {
      validationErrors.push(
        `Plan contains ${plan.actions.length} actions, exceeding maxActionsPerJourney limit of ${this.maxActionsPerJourney}.`
      );
    }

    // 3. Step-by-Step Action Validation
    for (let i = 0; i < plan.actions.length; i++) {
      const action = plan.actions[i];
      const actionId = action.id || `action-${i + 1}`;

      // 3a. Allowlisted action type check
      if (!ALLOWED_ACTION_TYPES.includes(action.type)) {
        rejectedActions.push({
          actionId,
          actionType: action.type,
          targetDescription: action.targetDescription || '',
          reason: `Action type "${action.type}" is not in the allowlisted vocabulary.`,
          ruleViolated: 'UNALLOWLISTED_ACTION',
        });
        continue;
      }

      // 3b. Dangerous action check
      const danger = isDangerousAction(
        action.targetDescription || '',
        undefined,
        action.type
      );
      if (danger.dangerous) {
        rejectedActions.push({
          actionId,
          actionType: action.type,
          targetDescription: action.targetDescription || '',
          reason: danger.reason || 'Destructive or sensitive action detected.',
          ruleViolated: 'DANGEROUS_ACTION',
        });
        continue;
      }

      // 3c. URL & SSRF validation for NAVIGATE actions
      if (action.type === 'NAVIGATE' || action.pageUrl) {
        const urlToTest = action.type === 'NAVIGATE' ? (action.expected?.url || action.pageUrl) : action.pageUrl;
        
        if (!urlToTest) {
          rejectedActions.push({
            actionId,
            actionType: action.type,
            targetDescription: action.targetDescription || '',
            reason: 'NAVIGATE action must specify a valid pageUrl.',
            ruleViolated: 'INVALID_URL',
          });
          continue;
        }

        const ssrfCheck = validateTargetUrl(urlToTest, {
          allowLocalhost: this.allowLocalhost,
        });

        if (!ssrfCheck.valid) {
          rejectedActions.push({
            actionId,
            actionType: action.type,
            targetDescription: action.targetDescription || '',
            reason: `SSRF Violation: ${ssrfCheck.error}`,
            ruleViolated: 'SSRF_SECURITY_VIOLATION',
          });
          continue;
        }

        // Scope origin check (must match target origin unless localhost allowed in tests)
        try {
          const actionOrigin = new URL(urlToTest).origin;
          if (this.scopeOrigin && actionOrigin !== this.scopeOrigin) {
            rejectedActions.push({
              actionId,
              actionType: action.type,
              targetDescription: action.targetDescription || '',
              reason: `Cross-origin navigation forbidden: target origin "${actionOrigin}" does not match scope "${this.scopeOrigin}".`,
              ruleViolated: 'CROSS_ORIGIN',
            });
            continue;
          }
        } catch {
          rejectedActions.push({
            actionId,
            actionType: action.type,
            targetDescription: action.targetDescription || '',
            reason: `Invalid URL format: "${urlToTest}".`,
            ruleViolated: 'INVALID_URL',
          });
          continue;
        }
      }

      // 3d. Sensitive field check for FILL actions
      if (action.type === 'FILL') {
        const fieldCheck = isSensitiveField({
          name: action.selector,
          label: action.targetDescription,
          placeholder: action.targetDescription,
        });

        if (fieldCheck.sensitive) {
          rejectedActions.push({
            actionId,
            actionType: action.type,
            targetDescription: action.targetDescription || '',
            reason: `Sensitive field detected: ${fieldCheck.reason}. Typing into credentials, tokens, or cards is forbidden.`,
            ruleViolated: 'SENSITIVE_FIELD',
          });
          continue;
        }
      }

      // 3e. Selector check for element interactions
      if (['CLICK', 'FILL', 'SELECT', 'CHECK', 'UNCHECK'].includes(action.type) && !action.selector) {
        rejectedActions.push({
          actionId,
          actionType: action.type,
          targetDescription: action.targetDescription || '',
          reason: `Action "${action.type}" requires a non-empty CSS selector.`,
          ruleViolated: 'MISSING_SELECTOR',
        });
        continue;
      }

      // Action passed all safety checks
      approvedActions.push(action);
    }

    const sanitizedPlan: AIQAPlan = {
      ...plan,
      actions: approvedActions,
    };

    return {
      approved: approvedActions.length > 0 && validationErrors.length === 0,
      sanitizedPlan,
      approvedActions,
      rejectedActions,
      validationErrors,
    };
  }
}
