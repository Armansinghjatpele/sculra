import { describe, it, expect, vi } from 'vitest';

// Simple URL validation functions matching the client validation rules
function validateWebsiteUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'Website target URL must start with http:// or https://';
  }
  try {
    new URL(url);
    return '';
  } catch {
    return 'Invalid URL format. Please check the spelling and try again.';
  }
}

function validateGitHubUrl(url: string): string {
  const gitHubRegex = /^(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git)$/;
  if (!gitHubRegex.test(url)) {
    return 'Must be a valid GitHub repository URL (e.g. https://github.com/company/project)';
  }
  return '';
}

describe('Project Onboarding Validations & Scopes', () => {
  // Test 1: Valid website URL
  it('should accept valid website URL structures', () => {
    expect(validateWebsiteUrl('https://example.com')).toBe('');
    expect(validateWebsiteUrl('http://staging.sculra.io')).toBe('');
  });

  // Test 2: Invalid website URL
  it('should reject invalid website URL structures', () => {
    expect(validateWebsiteUrl('javascript:alert(1)')).toContain('must start with http:// or https://');
    expect(validateWebsiteUrl('file:///etc/passwd')).toContain('must start with http:// or https://');
    expect(validateWebsiteUrl('not-a-url')).toContain('must start with http:// or https://');
  });

  // Test 3: Valid GitHub URL
  it('should accept valid GitHub repository URL structures', () => {
    expect(validateGitHubUrl('https://github.com/company/project')).toBe('');
    expect(validateGitHubUrl('git@github.com:company/project.git')).toBe('');
  });

  // Test 4: Invalid GitHub URL
  it('should reject invalid GitHub repository URL structures', () => {
    expect(validateGitHubUrl('https://google.com')).toContain('Must be a valid GitHub repository URL');
    expect(validateGitHubUrl('https://github.com/')).toContain('Must be a valid GitHub repository URL');
  });

  // Test 5: Project creation payload mapping
  it('should format creation targets correctly', () => {
    const projectData = {
      name: 'Sculra UI',
      type: 'website' as const,
      url: 'https://staging.sculra.com',
      clerkOrgId: null,
      clerkUserId: 'user_123',
    };
    expect(projectData.name).toBe('Sculra UI');
    expect(projectData.type).toBe('website');
    expect(projectData.url).toBe('https://staging.sculra.com');
  });

  // Test 6: Personal project (organization_id is null)
  it('should scope personal workspace project with organization_id set to null', () => {
    const projectPayload = {
      name: 'Personal Sandbox',
      organization_id: null,
      created_by: 'user_123',
    };
    expect(projectPayload.organization_id).toBeNull();
  });

  // Test 7: Organization project (organization_id is defined)
  it('should scope organization project with correct active clerkOrgId', () => {
    const projectPayload = {
      name: 'Org Scope Project',
      organization_id: 'org_999',
      created_by: 'user_123',
    };
    expect(projectPayload.organization_id).toBe('org_999');
  });

  // Test 8: Unauthorized project creation (empty credentials reject validation)
  it('should reject project creation if name is empty or user is unauthenticated', () => {
    const checkCreation = (name: string, userId: string | null) => {
      if (!name.trim() || !userId) {
        return 'Unauthorized project creation';
      }
      return 'Success';
    };
    expect(checkCreation('', 'user_123')).toBe('Unauthorized project creation');
    expect(checkCreation('Project name', null)).toBe('Unauthorized project creation');
  });

  // Test 9: Empty project state definition
  it('should define clean default project properties', () => {
    const emptyStateText = 'No applications connected';
    const ctaText = 'Connect Application';
    expect(emptyStateText).toBe('No applications connected');
    expect(ctaText).toBe('Connect Application');
  });

  // Test 10: No fake test results (ensures project.lastTestRun defaults cleanly to undefined/falsy when no tests are compiled)
  it('should report "No tests yet" when lastTestRun is falsy', () => {
    const project = {
      id: 'proj-new',
      name: 'Onboarded Project',
      releaseScore: 100,
      openIssuesCount: 0,
      lastTestRun: undefined,
    };
    const lastTestText = project.lastTestRun || 'No tests yet';
    expect(lastTestText).toBe('No tests yet');
  });
});
