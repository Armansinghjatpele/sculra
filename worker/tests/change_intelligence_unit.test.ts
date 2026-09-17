import { describe, it, expect } from 'vitest';
import {
  normalizeRepoPath,
  isBinaryFile,
  isLockfile,
  isDocumentation,
  isGeneratedOrMinified,
} from '../src/change-intelligence/normalizer';
import { parseUnifiedDiff } from '../src/change-intelligence/parser';
import { classifyChangedFile } from '../src/change-intelligence/classifier';
import { calculateChangeRisk } from '../src/change-intelligence/risk';
import { maskSecrets } from '../src/change-intelligence/redaction';
import {
  MAX_HUNKS_PER_FILE,
  MAX_LINES_PER_HUNK,
} from '../src/change-intelligence/policy';
import { ChangeSet, ChangedFile } from '../src/change-intelligence/types';

describe('Change Intelligence Unit Tests', () => {
  describe('Safe Path Normalization & Security', () => {
    it('normalizes relative, backslashed, and leading slash paths', () => {
      expect(normalizeRepoPath('src\\components\\Button.tsx')).toBe('src/components/Button.tsx');
      expect(normalizeRepoPath('/app/api/route.ts')).toBe('app/api/route.ts');
      expect(normalizeRepoPath('./src/utils.ts')).toBe('src/utils.ts');
    });

    it('defends against directory traversal patterns', () => {
      expect(() => normalizeRepoPath('../../etc/passwd')).toThrow();
      expect(() => normalizeRepoPath('src/../../secrets.env')).toThrow();
      expect(() => normalizeRepoPath('C:\\Windows\\System32\\cmd.exe')).toThrow();
    });

    it('identifies file types correctly', () => {
      expect(isBinaryFile('logo.png')).toBe(true);
      expect(isBinaryFile('font.woff2')).toBe(true);
      expect(isBinaryFile('main.ts')).toBe(false);

      expect(isLockfile('package-lock.json')).toBe(true);
      expect(isLockfile('pnpm-lock.yaml')).toBe(true);
      expect(isLockfile('package.json')).toBe(false);

      expect(isDocumentation('README.md')).toBe(true);
      expect(isDocumentation('docs/architecture.md')).toBe(true);
      expect(isDocumentation('src/README.ts')).toBe(false);

      expect(isGeneratedOrMinified('bundle.min.js')).toBe(true);
      expect(isGeneratedOrMinified('.next/static/chunk.js')).toBe(true);
      expect(isGeneratedOrMinified('src/index.ts')).toBe(false);
    });
  });

  describe('Bounded Unified Diff Parser', () => {
    it('parses standard unified diff hunks correctly', () => {
      const sampleDiff = `
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,4 +10,6 @@ export function verifyToken(token: string) {
   if (!token) return false;
+  if (token.startsWith('admin-')) return true;
+  return validateJwt(token);
 }
`;
      const result = parseUnifiedDiff(sampleDiff);
      expect(result.hunks.length).toBe(1);
      expect(result.additions).toBe(2);
      expect(result.deletions).toBe(0);
      expect(result.isTruncated).toBe(false);
      expect(result.hunks[0].newLines).toBe(6);
      expect(result.hunks[0].lines.length).toBeGreaterThan(0);
    });

    it('enforces hunk count limits and marks truncated safely', () => {
      let oversizedDiff = '';
      for (let i = 0; i < MAX_HUNKS_PER_FILE + 10; i++) {
        oversizedDiff += `@@ -${i * 10},2 +${i * 10},2 @@\n-old\n+new\n`;
      }

      const result = parseUnifiedDiff(oversizedDiff);
      expect(result.isTruncated).toBe(true);
      expect(result.hunks.length).toBeLessThanOrEqual(MAX_HUNKS_PER_FILE);
      expect(result.truncationReason).toBeDefined();
    });

    it('enforces line count limits per hunk safely', () => {
      let hugeHunk = '@@ -1,1 +1,400 @@\n';
      for (let i = 0; i < MAX_LINES_PER_HUNK + 50; i++) {
        hugeHunk += `+added_line_${i}\n`;
      }

      const result = parseUnifiedDiff(hugeHunk);
      expect(result.isTruncated).toBe(true);
      expect(result.hunks[0].lines.length).toBeLessThanOrEqual(MAX_LINES_PER_HUNK);
    });
  });

  describe('Multi-Evidence Semantic File Classifier', () => {
    it('classifies authentication and authorization changes', () => {
      const classes1 = classifyChangedFile('src/auth/session.ts', []);
      expect(classes1).toContain('AUTHENTICATION');

      const classes2 = classifyChangedFile('src/middleware.ts', [
        {
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          lines: ['+export function checkPermissions(role: Role) {'],
        },
      ]);
      expect(classes2).toContain('AUTHORIZATION');
    });

    it('classifies Next.js API endpoints and routes', () => {
      const apiClasses = classifyChangedFile('app/api/checkout/route.ts', []);
      expect(apiClasses).toContain('API');

      const pageClasses = classifyChangedFile('app/dashboard/page.tsx', []);
      expect(pageClasses).toContain('ROUTING');
      expect(pageClasses).toContain('UI');
    });

    it('classifies database, migrations, and ORM changes', () => {
      const dbClasses = classifyChangedFile('supabase/migrations/20260912_test.sql', []);
      expect(dbClasses).toContain('DATABASE');

      const prismaClasses = classifyChangedFile('prisma/schema.prisma', []);
      expect(prismaClasses).toContain('DATABASE');
    });

    it('classifies styling, configuration, documentation, and tests', () => {
      expect(classifyChangedFile('src/styles/globals.css', [])).toContain('UI');
      expect(classifyChangedFile('tsconfig.json', [])).toContain('CONFIGURATION');
      expect(classifyChangedFile('README.md', [])).toContain('DOCUMENTATION');
      expect(classifyChangedFile('tests/e2e.test.ts', [])).toContain('TEST');
    });
  });

  describe('Deterministic Change Risk Scoring Engine', () => {
    it('produces 0-100 risk score and explainable factors without fake data', () => {
      const files: ChangedFile[] = [
        {
          path: 'src/auth/jwt.ts',
          status: 'MODIFIED',
          additions: 50,
          deletions: 10,
          changes: 60,
          hunks: [],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: ['AUTHENTICATION'],
        },
      ];

      const changeSet: ChangeSet = {
        id: 'cs-test',
        commitSha: 'abc1234',
        files,
        totalAdditions: 50,
        totalDeletions: 10,
        sizeCategory: 'MEDIUM',
        isPartial: false,
        createdAt: new Date().toISOString(),
      };

      const risk = calculateChangeRisk({
        changeSet,
        classifications: ['AUTHENTICATION'],
        affectedWorkflows: [
          { workflowId: 'wf-login', workflowName: 'User Login', criticality: 'CRITICAL', confidence: 'HIGH', reason: 'Auth workflow' },
        ],
        affectedApis: [{ path: '/api/auth/token', method: 'POST', confidence: 'HIGH', reason: 'Token endpoint' }],
        historicalAssociations: [],
      });

      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(100);
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(risk.level);
      expect(risk.factors.length).toBeGreaterThan(0);
      expect(risk.explanation).toBeDefined();

      // Auth + Critical workflow should result in HIGH or CRITICAL risk
      expect(['CRITICAL', 'HIGH']).toContain(risk.level);
    });

    it('evaluates low-risk documentation changes cleanly', () => {
      const files: ChangedFile[] = [
        {
          path: 'docs/guide.md',
          status: 'MODIFIED',
          additions: 10,
          deletions: 2,
          changes: 12,
          hunks: [],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: true,
          classifications: ['DOCUMENTATION'],
        },
      ];

      const changeSet: ChangeSet = {
        id: 'cs-doc',
        commitSha: 'doc1234',
        files,
        totalAdditions: 10,
        totalDeletions: 2,
        sizeCategory: 'SMALL',
        isPartial: false,
        createdAt: new Date().toISOString(),
      };

      const risk = calculateChangeRisk({
        changeSet,
        classifications: ['DOCUMENTATION'],
        affectedWorkflows: [],
        affectedApis: [],
        historicalAssociations: [],
      });

      expect(risk.level).toBe('LOW');
      expect(risk.score).toBeLessThan(30);
    });
  });

  describe('Secret Masking & Redaction', () => {
    it('masks Bearer tokens, GitHub personal access tokens, and private keys', () => {
      const rawDiff = `
+ const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
+ const bearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
+ const key = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEowIBAAKCAQEA0";
`;
      const masked = maskSecrets(rawDiff);
      expect(masked).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      expect(masked).not.toContain('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(masked).toContain('[REDACTED');
    });
  });
});
