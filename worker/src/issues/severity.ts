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

  // 1. Catastrophic / Entry Point / Security Failures -> CRITICAL
  if (
    bugType === 'API_UNEXPECTED_AUTHORIZED_ACCESS' ||
    bugType === 'AUTHENTICATION_BYPASS' ||
    bugType === 'PRIVILEGE_ESCALATION' ||
    bugType === 'SECRET_EXPOSURE' ||
    bugType === 'TOKEN_EXPOSURE'
  ) {
    return 'critical';
  }
  if (isInitialPage && (statusCode && statusCode >= 500)) {
    return 'critical';
  }
  if (bugType === 'PAGE_LOAD_FAILURE' && isInitialPage) {
    return 'critical';
  }

  // 2. Primary Navigation / Critical API / Primary CTA / High Security / High Performance -> HIGH
  if (
    bugType === 'API_HTTP_5XX' ||
    bugType === 'API_TIMEOUT' ||
    bugType === 'API_NETWORK_FAILURE' ||
    bugType === 'API_AUTHORIZATION_FAILURE' ||
    bugType === 'API_AUTHENTICATION_FAILURE' ||
    bugType === 'PUBLICLY_ACCESSIBLE_PROTECTED_ROUTE' ||
    bugType === 'PUBLICLY_ACCESSIBLE_PROTECTED_API' ||
    bugType === 'VERTICAL_ACCESS_VIOLATION' ||
    bugType === 'HORIZONTAL_ACCESS_VIOLATION' ||
    bugType === 'AUTHORIZATION_UNEXPECTED_ACCESS' ||
    bugType === 'AUTHENTICATION_MISSING' ||
    bugType === 'AUTHORIZATION_DENIED' ||
    bugType === 'SENSITIVE_DATA_EXPOSURE' ||
    bugType === 'PERFORMANCE_TIMEOUT' ||
    bugType === 'PERFORMANCE_API_TIMEOUT' ||
    bugType === 'PERFORMANCE_PAGE_UNRELIABLE' ||
    bugType === 'PERFORMANCE_JOURNEY_UNRELIABLE' ||
    bugType === 'PERFORMANCE_RUNTIME_UNSTABLE'
  ) {
    return 'high';
  }
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

  // 3. Secondary Controls / Forms / API Content / Schema / Medium Security / Medium Performance -> MEDIUM
  if (
    bugType === 'API_INVALID_JSON' ||
    bugType === 'API_SCHEMA_VIOLATION' ||
    bugType === 'API_REQUIRED_FIELD_MISSING' ||
    bugType === 'API_RESPONSE_MALFORMED' ||
    bugType === 'API_HTTP_4XX' ||
    bugType === 'API_UNEXPECTED_STATUS' ||
    bugType === 'API_UNEXPECTED_REDIRECT' ||
    bugType === 'API_CONTENT_TYPE_MISMATCH' ||
    bugType === 'SECURITY_HEADER_MISSING' ||
    bugType === 'SECURITY_HEADER_WEAK' ||
    bugType === 'INSECURE_COOKIE' ||
    bugType === 'COOKIE_MISSING_SECURITY_ATTRIBUTE' ||
    bugType === 'CORS_MISCONFIGURATION' ||
    bugType === 'OPEN_REDIRECT' ||
    bugType === 'INSECURE_HTTP_CONFIGURATION' ||
    bugType === 'PERFORMANCE_NAVIGATION_SLOW' ||
    bugType === 'PERFORMANCE_TTFB_SLOW' ||
    bugType === 'PERFORMANCE_LCP_SLOW' ||
    bugType === 'PERFORMANCE_API_SLOW' ||
    bugType === 'PERFORMANCE_TOO_MANY_REQUESTS' ||
    bugType === 'PERFORMANCE_NETWORK_FAILURE' ||
    bugType === 'PERFORMANCE_RESOURCE_LARGE' ||
    bugType === 'PERFORMANCE_REGRESSION'
  ) {
    return 'medium';
  }
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

  // 4. Low Impact / Recoverable / Low Security / Low Performance -> LOW
  if (
    bugType === 'MIXED_CONTENT' ||
    bugType === 'SECURITY_CONFIGURATION_ERROR' ||
    bugType === 'PERFORMANCE_FCP_SLOW' ||
    bugType === 'PERFORMANCE_INP_SLOW' ||
    bugType === 'PERFORMANCE_CLS_HIGH' ||
    bugType === 'PERFORMANCE_RESOURCE_SLOW' ||
    bugType === 'PERFORMANCE_BASELINE_MISSING' ||
    bugType === 'PERFORMANCE_CONFIGURATION_ERROR'
  ) {
    return 'low';
  }

  if (
    bugType === 'API_CONFIGURATION_ERROR' ||
    bugType === 'SECURITY_CHECK_INCONCLUSIVE' ||
    bugType === 'PERFORMANCE_INCONCLUSIVE'
  ) {
    return 'info';
  }

  return 'low';
}
