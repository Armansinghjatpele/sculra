// ==============================================================================
// Sculra Multi-Evidence Change Classifier (worker/src/change-intelligence/classifier.ts)
// ==============================================================================

import { ChangeClassification, ChangeHunk } from './types';
import { isDocumentation, isLockfile, isTestFile } from './normalizer';

/**
 * Classifies a changed file into semantic architectural categories based on multiple
 * pieces of deterministic evidence: file path, directory context, extension, and diff content.
 */
export function classifyChangedFile(
  filePath: string,
  hunks: ChangeHunk[] = []
): ChangeClassification[] {
  const classifications = new Set<ChangeClassification>();
  const lowerPath = filePath.toLowerCase();
  const filename = lowerPath.split('/').pop() || '';

  // 1. Documentation Check
  if (isDocumentation(filePath)) {
    classifications.add('DOCUMENTATION');
  }

  // 2. Lockfiles & Dependencies
  if (isLockfile(filePath) || filename === 'package.json' || filename === 'requirements.txt' || filename === 'gemfile') {
    classifications.add('DEPENDENCY');
  }

  // 3. Test files
  if (isTestFile(filePath)) {
    classifications.add('TEST');
  }

  // 4. Configuration files
  if (
    filename.startsWith('.env') ||
    filename === 'next.config.js' ||
    filename === 'next.config.ts' ||
    filename === 'next.config.mjs' ||
    filename === 'tsconfig.json' ||
    filename === 'vite.config.ts' ||
    filename === 'tailwind.config.js' ||
    filename === 'tailwind.config.ts' ||
    filename === 'dockerfile' ||
    filename.startsWith('docker-compose')
  ) {
    classifications.add('CONFIGURATION');
  }

  // 5. Database & Schema changes
  if (
    lowerPath.includes('migration') ||
    lowerPath.endsWith('.sql') ||
    filename === 'schema.prisma' ||
    lowerPath.includes('/db/') ||
    lowerPath.includes('/database/')
  ) {
    classifications.add('DATABASE');
  }

  // 6. API changes
  if (
    lowerPath.includes('/api/') ||
    lowerPath.includes('api-') ||
    lowerPath.includes('/controllers/') ||
    lowerPath.includes('/endpoints/') ||
    filename.includes('openapi') ||
    filename.includes('swagger')
  ) {
    classifications.add('API');
  }

  // 7. Routing & App Structure
  if (
    lowerPath.includes('app/') ||
    lowerPath.includes('pages/') ||
    filename === 'page.tsx' ||
    filename === 'layout.tsx' ||
    filename === 'route.ts' ||
    lowerPath.includes('/routes/')
  ) {
    classifications.add('ROUTING');
  }

  // 8. UI Components & Styling
  if (
    lowerPath.includes('/components/') ||
    lowerPath.endsWith('.tsx') ||
    lowerPath.endsWith('.jsx') ||
    lowerPath.endsWith('.vue') ||
    lowerPath.endsWith('.svelte') ||
    lowerPath.endsWith('.css') ||
    lowerPath.endsWith('.scss')
  ) {
    classifications.add('UI');
  }

  // 9. Navigation
  if (
    lowerPath.includes('nav') ||
    lowerPath.includes('header') ||
    lowerPath.includes('sidebar') ||
    lowerPath.includes('footer') ||
    lowerPath.includes('menu')
  ) {
    classifications.add('NAVIGATION');
  }

  // 10. Forms
  if (lowerPath.includes('form') || filename.includes('input') || filename.includes('select')) {
    classifications.add('FORM');
  }

  // 11. Authentication & Authorization
  if (
    lowerPath.includes('auth') ||
    lowerPath.includes('login') ||
    lowerPath.includes('signup') ||
    lowerPath.includes('register') ||
    lowerPath.includes('session')
  ) {
    classifications.add('AUTHENTICATION');
  }
  if (
    lowerPath.includes('role') ||
    lowerPath.includes('permission') ||
    lowerPath.includes('rbac') ||
    lowerPath.includes('guard')
  ) {
    classifications.add('AUTHORIZATION');
  }

  // 12. Payment & Checkout
  if (
    lowerPath.includes('payment') ||
    lowerPath.includes('checkout') ||
    lowerPath.includes('billing') ||
    lowerPath.includes('stripe') ||
    lowerPath.includes('pricing') ||
    lowerPath.includes('cart')
  ) {
    classifications.add('PAYMENT');
  }

  // 13. Search
  if (lowerPath.includes('search') || lowerPath.includes('filter')) {
    classifications.add('SEARCH');
  }

  // 14. Deep Content / Diff Inspection for Strong Evidence
  if (hunks.length > 0) {
    const diffSample = hunks
      .flatMap((h) => h.lines)
      .slice(0, 200)
      .join('\n')
      .toLowerCase();

    if (diffSample.includes('stripe') || diffSample.includes('createcheckoutsession') || diffSample.includes('cardelement')) {
      classifications.add('PAYMENT');
    }
    if (diffSample.includes('signin') || diffSample.includes('signout') || diffSample.includes('clerk') || diffSample.includes('bcrypt')) {
      classifications.add('AUTHENTICATION');
    }
    if (diffSample.includes('isauthorized') || diffSample.includes('hasrole') || diffSample.includes('permissions')) {
      classifications.add('AUTHORIZATION');
    }
    if (diffSample.includes('aria-') || diffSample.includes('role=') || diffSample.includes('tabindex')) {
      classifications.add('ACCESSIBILITY');
    }
    if (diffSample.includes('usememo') || diffSample.includes('usecallback') || diffSample.includes('debounce') || diffSample.includes('throttle')) {
      classifications.add('PERFORMANCE');
    }
    if (diffSample.includes('csrf') || diffSample.includes('cors') || diffSample.includes('jwt.verify') || diffSample.includes('sanitize')) {
      classifications.add('SECURITY');
    }
    if (diffSample.includes('<form') || diffSample.includes('handlesubmit') || diffSample.includes('formdata')) {
      classifications.add('FORM');
    }
  }

  if (classifications.size === 0) {
    classifications.add('UNKNOWN');
  }

  return Array.from(classifications);
}
