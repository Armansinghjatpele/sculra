import { describe, it, expect } from 'vitest';
import {
  isPathAllowed,
  getCommitMessage,
  getTodayUtc,
  MAX_DIFF_LINES,
} from '../../scripts/maintenance/safety';

describe('Sculra Daily Maintenance Safety System', () => {
  describe('Path Safety Boundaries', () => {
    it('should strictly reject authentication & session files', () => {
      expect(isPathAllowed('middleware.ts')).toBe(false);
      expect(isPathAllowed('frontend/middleware.ts')).toBe(false);
      expect(isPathAllowed('frontend/app/api/auth/route.ts')).toBe(false);
      expect(isPathAllowed('frontend/lib/auth.ts')).toBe(false);
      expect(isPathAllowed('frontend/components/clerk/UserButton.tsx')).toBe(false);
    });

    it('should strictly reject database migrations and schema definitions', () => {
      expect(isPathAllowed('supabase/migrations/20260101_init.sql')).toBe(false);
      expect(isPathAllowed('database/schema.sql')).toBe(false);
    });

    it('should strictly reject secrets, environment variables, and security policies', () => {
      expect(isPathAllowed('.env')).toBe(false);
      expect(isPathAllowed('.env.local')).toBe(false);
      expect(isPathAllowed('.env.production')).toBe(false);
      expect(isPathAllowed('SECURITY.md')).toBe(false);
    });

    it('should strictly reject billing and payment logic', () => {
      expect(isPathAllowed('frontend/app/billing/page.tsx')).toBe(false);
      expect(isPathAllowed('frontend/services/stripe.ts')).toBe(false);
      expect(isPathAllowed('backend/payments/webhook.ts')).toBe(false);
    });

    it('should strictly reject CI workflow configuration modification', () => {
      expect(isPathAllowed('.github/workflows/ci.yml')).toBe(false);
    });

    it('should permit safe maintenance paths (docs, types, test suites, non-auth utilities)', () => {
      expect(isPathAllowed('docs/Architecture.md')).toBe(true);
      expect(isPathAllowed('docs/CHANGELOG.md')).toBe(true);
      expect(isPathAllowed('README.md')).toBe(true);
      expect(isPathAllowed('DEVELOPMENT.md')).toBe(true);
      expect(isPathAllowed('shared/types/index.ts')).toBe(true);
      expect(isPathAllowed('shared/utils/validators.ts')).toBe(true);
      expect(isPathAllowed('frontend/tests/onboarding.test.ts')).toBe(true);
    });
  });

  describe('Commit Format & Rate Limiting Attributes', () => {
    it('should format commit message with exact required automated template', () => {
      const today = getTodayUtc();
      const message = getCommitMessage();
      expect(message).toBe(`chore(auto): daily Sculra maintenance ${today}`);
      expect(message).toMatch(/^chore\(auto\): daily Sculra maintenance \d{4}-\d{2}-\d{2}$/);
    });

    it('should enforce reasonable diff line thresholds', () => {
      expect(MAX_DIFF_LINES).toBeGreaterThanOrEqual(20);
      expect(MAX_DIFF_LINES).toBeLessThanOrEqual(100);
    });
  });
});
