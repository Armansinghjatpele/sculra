// ==============================================================================
// Sculra Deterministic Safety Policy & Sensitive Data Protection (worker/src/journeys/safety.ts)
// ==============================================================================

const DANGEROUS_ACTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Destructive deletion / removal
  { pattern: /\b(delete|remove|destroy|permanently delete|wipe|purge|deactivate|close account|cancel subscription)\b/i, reason: 'Potentially destructive deletion or account cancellation action' },
  // Authentication termination
  { pattern: /\b(log[\s-]?out|sign[\s-]?out|deauth)\b/i, reason: 'Session termination (logout/signout)' },
  // Financial transactions / payments
  { pattern: /\b(purchase|checkout|pay|charge|transfer|withdraw|send money|submit payment|buy now|order now|checkout now)\b/i, reason: 'Financial payment or monetary transaction' },
  // External communications & production writes
  { pattern: /\b(publish|deploy|send email|send message|broadcast|invite member|add user)\b/i, reason: 'Outbound communication or deployment action' },
];

const SENSITIVE_FIELD_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // Passwords & PINs
  { pattern: /\b(password|passwd|pwd|passcode|pin)\b/i, reason: 'Password or PIN entry' },
  // Multi-factor & OTP
  { pattern: /\b(otp|2fa|mfa|one[\s-]?time|auth[\s-]?code|verification[\s-]?code)\b/i, reason: 'Two-factor or OTP token' },
  // Secrets & API Keys
  { pattern: /\b(secret|token|api[\s-]?key|private[\s-]?key|access[\s-]?key)\b/i, reason: 'API key or secret token' },
  // Payment Cards & CVV
  { pattern: /\b(credit[\s-]?card|card[\s-]?number|cardnumber|cvv|cvc|exp[\s-]?date|expiration|security[\s-]?code)\b/i, reason: 'Payment card or CVV credential' },
  // Government IDs & SSN
  { pattern: /\b(ssn|social[\s-]?security|tax[\s-]?id|national[\s-]?id|ein|passport)\b/i, reason: 'Government or tax identification identifier' },
  // Banking details
  { pattern: /\b(bank[\s-]?account|account[\s-]?number|routing[\s-]?number|iban|swift)\b/i, reason: 'Bank account credential' },
];

export interface FieldClassificationInput {
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  type?: string;
  autocomplete?: string;
}

export function isDangerousAction(
  text: string,
  ariaLabel?: string,
  role?: string
): { dangerous: boolean; reason?: string } {
  const raw = `${text || ''} ${ariaLabel || ''} ${role || ''}`.toLowerCase();
  const normalized = raw.replace(/[-_./]/g, ' ');

  for (const { pattern, reason } of DANGEROUS_ACTION_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return { dangerous: true, reason };
    }
  }

  return { dangerous: false };
}

export function isSensitiveField(field: FieldClassificationInput): {
  sensitive: boolean;
  reason?: string;
} {
  const typeLower = (field.type || '').toLowerCase();
  if (typeLower === 'password') {
    return { sensitive: true, reason: 'Input type is explicitly "password"' };
  }

  const raw = `${field.name || ''} ${field.id || ''} ${field.label || ''} ${field.placeholder || ''} ${field.autocomplete || ''}`.toLowerCase();
  const normalized = raw.replace(/[-_./]/g, ' ');

  for (const { pattern, reason } of SENSITIVE_FIELD_PATTERNS) {
    if (pattern.test(raw) || pattern.test(normalized)) {
      return { sensitive: true, reason };
    }
  }

  return { sensitive: false };
}

export function getDeterministicFieldValue(field: FieldClassificationInput & { options?: string[] }): string {
  const raw = `${field.name || ''} ${field.label || ''} ${field.placeholder || ''}`.toLowerCase();
  const combined = raw.replace(/[-_./]/g, ' ');
  const typeLower = (field.type || '').toLowerCase();

  // 1. If options exist (e.g. select dropdown), pick the first valid non-empty option
  if (field.options && field.options.length > 0) {
    const valid = field.options.find((opt) => opt && opt.trim().length > 0);
    if (valid) return valid.trim();
  }

  // 2. Email fields
  if (typeLower === 'email' || combined.includes('email') || combined.includes('e mail')) {
    return 'sculra.test.fixture@example.com';
  }

  // 3. Name fields
  if (/\b(first[\s_-]?name|fname)\b/i.test(raw) || /\b(first[\s_-]?name|fname)\b/i.test(combined)) {
    return 'Sculra';
  }
  if (/\b(last[\s_-]?name|lname)\b/i.test(raw) || /\b(last[\s_-]?name|lname)\b/i.test(combined)) {
    return 'Test';
  }
  if (/\b(full[\s_-]?name|name)\b/i.test(raw) || /\b(full[\s_-]?name|name)\b/i.test(combined)) {
    return 'Sculra Test User';
  }

  // 4. Phone fields
  if (typeLower === 'tel' || combined.includes('phone') || combined.includes('telephone') || combined.includes('mobile')) {
    return '+15550199999';
  }

  // 5. Search queries
  if (typeLower === 'search' || combined.includes('search') || field.name === 'q' || field.name === 'query') {
    return 'Sculra QA';
  }

  // 6. Number / Integer fields
  if (typeLower === 'number' || combined.includes('age') || combined.includes('quantity') || combined.includes('count')) {
    return '1';
  }

  // 7. URLs
  if (typeLower === 'url' || combined.includes('website') || combined.includes('homepage')) {
    return 'https://example.com';
  }

  // 8. Long text / Textareas
  if (typeLower === 'textarea' || combined.includes('message') || combined.includes('comment') || combined.includes('feedback') || combined.includes('description')) {
    return 'Sculra automated QA validation test message';
  }

  // Default fallback
  return 'Sculra Test';
}
