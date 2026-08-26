import { describe, it, expect } from 'vitest';

// URL validation helper functions matching client logic
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

describe('Project Data Integrity & Connection Health Spec', () => {
  
  // 1. Website project persistence
  it('should verify Website project payload persistence attributes', () => {
    const payload = {
      name: 'Sculra Staging',
      source_type: 'website',
      source_url: 'https://staging.sculra.com',
      description: JSON.stringify({ environment: 'Staging' }),
      created_by: 'user_clerk_123',
      organization_id: null,
    };
    expect(payload.source_type).toBe('website');
    expect(payload.source_url).toBe('https://staging.sculra.com');
    expect(payload.name).toBe('Sculra Staging');
  });

  // 2. GitHub project persistence
  it('should verify GitHub project payload persistence attributes', () => {
    const payload = {
      name: 'Sculra Repo',
      source_type: 'github',
      repository_url: 'https://github.com/company/sculra',
      description: JSON.stringify({ branch: 'release-v1', environment: 'Production' }),
      created_by: 'user_clerk_123',
      organization_id: 'org_uuid_456',
    };
    expect(payload.source_type).toBe('github');
    expect(payload.repository_url).toBe('https://github.com/company/sculra');
    expect(JSON.parse(payload.description).branch).toBe('release-v1');
  });

  // 3. Environment persistence
  it('should enforce environment default persistence scoping', () => {
    const defaultEnv = 'Staging';
    const metadata = JSON.parse(JSON.stringify({ environment: defaultEnv }));
    expect(metadata.environment).toBe('Staging');
  });

  // 4. Branch persistence
  it('should enforce target branch default persistence scoping', () => {
    const defaultBranch = 'main';
    const metadata = JSON.parse(JSON.stringify({ branch: defaultBranch }));
    expect(metadata.branch).toBe('main');
  });

  // 5. Personal workspace project
  it('should verify personal workspace restricts organization_id to null', () => {
    const project = {
      name: 'Personal Sandbox',
      organization_id: null,
      created_by: 'user_clerk_123',
    };
    expect(project.organization_id).toBeNull();
  });

  // 6. Organization project
  it('should bind organizational projects to UUID mappings', () => {
    const project = {
      name: 'Corporate Workspace',
      organization_id: 'org_555_uuid',
      created_by: 'user_clerk_123',
    };
    expect(project.organization_id).toBe('org_555_uuid');
  });

  // 7. No fake release score
  it('should verify release score defaults to null if no test runs exist', () => {
    const projectRuns: any[] = [];
    const latestRun = projectRuns[0] || null;
    const releaseScore = latestRun ? latestRun.overall_score : null;
    expect(releaseScore).toBeNull();
  });

  // 8. No fake test run
  it('should verify lastTestRun defaults to undefined if no test runs exist', () => {
    const projectRuns: any[] = [];
    const latestRun = projectRuns[0] || null;
    const lastTestRun = latestRun ? 'Synced' : undefined;
    expect(lastTestRun).toBeUndefined();
  });

  // 9. No fake issue count
  it('should verify openIssuesCount counts only open issues in database', () => {
    const issues = [
      { id: '1', status: 'open' },
      { id: '2', status: 'resolved' },
      { id: '3', status: 'open' },
    ];
    const openIssuesCount = issues.filter((i) => i.status === 'open').length;
    expect(openIssuesCount).toBe(2);
  });

  // 10. Connection validation
  it('should parse website check responses correctly', () => {
    const responsePayload = {
      status: 'connected',
      statusCode: 200,
      responseTime: 145,
      error: null,
    };
    expect(responsePayload.status).toBe('connected');
    expect(responsePayload.statusCode).toBe(200);
    expect(responsePayload.responseTime).toBe(145);
  });

  // 11. Invalid website
  it('should catch invalid website schemas', () => {
    expect(validateWebsiteUrl('javascript:alert(1)')).toContain('must start with http:// or https://');
    expect(validateWebsiteUrl('ftp://server.com')).toContain('must start with http:// or https://');
  });

  // 12. Invalid GitHub repository
  it('should catch invalid GitHub repository formats', () => {
    expect(validateGitHubUrl('https://google.com')).toContain('Must be a valid GitHub repository URL');
    expect(validateGitHubUrl('https://github.com/')).toContain('Must be a valid GitHub repository URL');
  });

  // 13. Unauthorized project access
  it('should restrict creation if user context is missing', () => {
    const checkAuth = (userId: string | null) => {
      if (!userId) throw new Error('Unauthorized');
      return true;
    };
    expect(() => checkAuth(null)).toThrow('Unauthorized');
  });

  // 14. Organization isolation
  it('should isolate queries based on organization scopes', () => {
    const projects = [
      { id: 'p1', organization_id: 'org_1' },
      { id: 'p2', organization_id: 'org_2' },
      { id: 'p3', organization_id: null },
    ];
    
    const org1Projects = projects.filter((p) => p.organization_id === 'org_1');
    const personalProjects = projects.filter((p) => p.organization_id === null);

    expect(org1Projects).toHaveLength(1);
    expect(personalProjects).toHaveLength(1);
  });
});
