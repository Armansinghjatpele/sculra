// ==============================================================================
// Sculra Deterministic Severity & CTA Heuristics (worker/src/issues/severity.ts)
// ==============================================================================

import { BugSeverity, BugType } from './types';
import { isDangerousAction } from '../journeys/safety';

const PRIMARY_CTA_KEYWORDS = [
  'get started',
  'start',
  'continue',
  'submit',
  'save',
  'create',
  'sign up',
  'signup',
  'register',
  'log in',
  'login',
  'signin',
  'sign in',
  'try',
  'next',
  'search',
  'explore',
  'buy',
  'upgrade',
  'book',
  'demo',
];

/**
 * Deterministically detects whether an element/button represents a primary Call To Action (CTA).
 */
export function isPrimaryCTA(
  targetText?: string,
  selector?: string,
  role?: string
): boolean {
  if (!targetText && !selector) return false;

  const combined = `${targetText || ''} ${selector || ''} ${role || ''}`.toLowerCase();

  // Explicitly ignore dangerous destructive actions from CTA elevation
  if (isDangerousAction(targetText || '', undefined, role).dangerous) {
    return false;
  }

  // Check against primary CTA keyword list
  for (const kw of PRIMARY_CTA_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(combined)) {
      return true;
    }
  }

  // Check if selector indicates primary action
  if (
    combined.includes('btn-primary') ||
    combined.includes('button-primary') ||
    combined.includes('cta') ||
    combined.includes('hero') ||
    combined.includes('main-action')
  ) {
    return true;
  }

  return false;
}

/**
 * Assigns a deterministic severity level based on bug type, element importance, and context.
 */
export function calculateBugSeverity(params: {
  bugType: BugType;
  url: string;
  isInitialPage?: boolean;
  statusCode?: number;
  targetDescription?: string;
  selector?: string;
  isCriticalResource?: boolean;
}): BugSeverity {
  const { bugType, statusCode, isInitialPage, targetDescription, selector, isCriticalResource } = params;

  // 1. Catastrophic / Entry Point Failures -> CRITICAL
  if (isInitialPage && (statusCode && statusCode >= 500)) {
    return 'critical';
  }
  if (bugType === 'PAGE_LOAD_FAILURE' && isInitialPage) {
    return 'critical';
  }

  // 2. Primary Navigation / Critical API / Primary CTA -> HIGH
  if (bugType === 'NAVIGATION_FAILURE' || (statusCode && statusCode === 404)) {
    return 'high';
  }
  if (bugType === 'HTTP_ERROR' && statusCode && statusCode >= 500) {
    return 'high';
  }
  if (bugType === 'NETWORK_ERROR' && isCriticalResource) {
    return 'high';
  }
  if (bugType === 'RUNTIME_EXCEPTION') {
    return 'high';
  }

  const isCTA = isPrimaryCTA(targetDescription, selector);
  if ((bugType === 'BROKEN_CONTROL' || bugType === 'CLICK_NO_OP') && isCTA) {
    return 'high';
  }

  // 3. Secondary Controls / Forms / Interactions -> MEDIUM
  if (bugType === 'BROKEN_CONTROL' || bugType === 'CLICK_NO_OP') {
    return 'medium';
  }
  if (bugType === 'FORM_SUBMISSION_FAILURE' || bugType === 'ELEMENT_NOT_INTERACTABLE') {
    return 'medium';
  }
  if (bugType === 'CONSOLE_ERROR') {
    return 'medium';
  }
  if (bugType === 'UNEXPECTED_NAVIGATION' || bugType === 'CLICK_TIMEOUT') {
    return 'medium';
  }

  // 4. Low Impact / Recoverable -> LOW
  return 'low';
}
