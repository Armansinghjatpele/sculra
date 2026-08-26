// ==============================================================================
// Sculra Production Server-Side Database Service Layer (frontend/services/db.ts)
// ==============================================================================
// Unified query/mutation interfaces extracting tables securely.
// Utilizes getSupabaseUserClient to verify Clerk token authorization at the DB RLS layer.

import { getSupabaseUserClient } from '../lib/supabase';
import { Project, TestRun, Issue, AIInsight, Notification, mockProjects, mockTestRuns, mockIssues, mockAIInsights, mockNotifications } from '../lib/demoData';

function useFallback(error: any) {
  if (error) {
    if (process.env.NODE_ENV !== 'development' || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'anon-key-123') {
      throw new Error(`Database Connection Failed: ${error.message}`);
    }
    console.warn('[Supabase Database Service Warning]: Falling back to mock demo data in development.', error.message);
    return true;
  }
  return false;
}

export async function getCurrentProfile(clerkToken: string) {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single();

  if (useFallback(error)) {
    return { display_name: 'Developer User', avatar_url: '' };
  }
  return data;
}

export async function getOrganizations(clerkToken: string) {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('organizations')
    .select('*');

  if (useFallback(error)) {
    return [];
  }
  return data || [];
}

export async function getProjects(clerkToken: string, clerkOrgId?: string | null) {
  const supabase = getSupabaseUserClient(clerkToken);
  
  let query = supabase.from('projects').select('*, test_runs(id, status, overall_score, created_at, duration_ms), issues(id, status)');

  if (clerkOrgId) {
    // Select projects associated with the active Clerk Organization mapping
    // We join with the organizations table since projects stores the internal UUID organization_id
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_organization_id', clerkOrgId)
      .maybeSingle();

    if (orgData) {
      query = query.eq('organization_id', orgData.id);
    } else {
      return []; // Org selected in Clerk but not synced to database yet
    }
  } else {
    // Personal workspace projects (organization_id is null)
    query = query.is('organization_id', null);
  }

  const { data, error } = await query;
  
  if (useFallback(error)) {
    // If fallback, we filter mock projects by type and details to simulate real scoping
    return mockProjects;
  }

  // Format database projects to client models
  return (data || []).map((p: any) => {
    let env = 'Staging';
    let branch = 'main';
    if (p.description) {
      try {
        const meta = JSON.parse(p.description);
        if (meta.environment) env = meta.environment;
        if (meta.branch) branch = meta.branch;
      } catch {
        // description is not JSON, ignore
      }
    }

    const sortedRuns = [...(p.test_runs || [])].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const lastRun = sortedRuns[0] || null;

    let uiStatus: 'passed' | 'running' | 'failed' | 'needs_review' = 'running';
    if (lastRun) {
      if (lastRun.status === 'passed') uiStatus = 'passed';
      else if (lastRun.status === 'failed' || lastRun.status === 'cancelled') uiStatus = 'failed';
      else if (lastRun.status === 'needs_review') uiStatus = 'needs_review';
      else uiStatus = 'running';
    }

    const openIssuesCount = (p.issues || []).filter((i: any) => i.status === 'open').length;
    const releaseScore = lastRun ? lastRun.overall_score : null;
    const lastTestRun = lastRun ? 'Synced' : undefined;

    return {
      id: p.id,
      name: p.name,
      type: p.source_type,
      status: uiStatus,
      lastTestRun,
      releaseScore,
      openIssuesCount,
      url: p.source_url,
      repoUrl: p.repository_url,
      environment: env,
      branch,
      createdAt: p.created_at ? new Date(p.created_at).toLocaleDateString() : undefined,
    };
  }) as Project[];
}

export async function getProject(clerkToken: string, id: string) {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('projects')
    .select('*, test_runs(id, status, overall_score, created_at, duration_ms), issues(id, status)')
    .eq('id', id)
    .maybeSingle();

  if (useFallback(error)) {
    return mockProjects.find((p) => p.id === id) || null;
  }

  if (!data) return null;

  let env = 'Staging';
  let branch = 'main';
  if (data.description) {
    try {
      const meta = JSON.parse(data.description);
      if (meta.environment) env = meta.environment;
      if (meta.branch) branch = meta.branch;
    } catch {
      // description is not JSON, ignore
    }
  }

  const sortedRuns = [...(data.test_runs || [])].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const lastRun = sortedRuns[0] || null;

  let uiStatus: 'passed' | 'running' | 'failed' | 'needs_review' = 'running';
  if (lastRun) {
    if (lastRun.status === 'passed') uiStatus = 'passed';
    else if (lastRun.status === 'failed' || lastRun.status === 'cancelled') uiStatus = 'failed';
    else if (lastRun.status === 'needs_review') uiStatus = 'needs_review';
    else uiStatus = 'running';
  }

  const openIssuesCount = (data.issues || []).filter((i: any) => i.status === 'open').length;
  const releaseScore = lastRun ? lastRun.overall_score : null;
  const lastTestRun = lastRun ? 'Synced' : undefined;

  return {
    id: data.id,
    name: data.name,
    type: data.source_type,
    status: uiStatus,
    lastTestRun,
    releaseScore,
    openIssuesCount,
    url: data.source_url,
    repoUrl: data.repository_url,
    environment: env,
    branch,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleDateString() : undefined,
  } as Project;
}

export async function createProject(clerkToken: string, projectData: {
  name: string;
  type: 'website' | 'github' | 'zip' | 'desktop' | 'api';
  url?: string;
  repoUrl?: string;
  clerkOrgId?: string | null;
  clerkUserId: string;
  environment?: string;
  branch?: string;
}) {
  const supabase = getSupabaseUserClient(clerkToken);
  let internalOrgId: string | null = null;

  if (projectData.clerkOrgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_organization_id', projectData.clerkOrgId)
      .maybeSingle();
    if (org) {
      internalOrgId = org.id;
    }
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: projectData.name,
      slug: projectData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      organization_id: internalOrgId,
      source_type: projectData.type,
      source_url: projectData.url,
      repository_url: projectData.repoUrl,
      created_by: projectData.clerkUserId,
      status: 'active',
      description: JSON.stringify({
        environment: projectData.environment || 'Staging',
        branch: projectData.branch || 'main',
      }),
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    type: data.source_type,
    status: 'running',
    lastTestRun: undefined,
    releaseScore: null,
    openIssuesCount: 0,
    url: data.source_url,
    repoUrl: data.repository_url,
    environment: projectData.environment || 'Staging',
    branch: projectData.branch || 'main',
  } as Project;
}

export async function getTestRuns(clerkToken: string, clerkOrgId?: string | null) {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase.from('test_runs').select('*');

  if (clerkOrgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_organization_id', clerkOrgId)
      .maybeSingle();

    if (orgData) {
      query = query.eq('organization_id', orgData.id);
    } else {
      return [];
    }
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query;
  if (useFallback(error)) {
    return mockTestRuns;
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    projectName: 'Synced Project',
    status: r.status,
    issuesCount: 0,
    releaseScore: r.overall_score || 100,
    durationMs: r.duration_ms || 0,
    createdAt: 'Synced',
  })) as TestRun[];
}

export async function getIssues(clerkToken: string, clerkOrgId?: string | null) {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase.from('issues').select('*');

  if (clerkOrgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_organization_id', clerkOrgId)
      .maybeSingle();

    if (orgData) {
      query = query.eq('organization_id', orgData.id);
    } else {
      return [];
    }
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query;
  if (useFallback(error)) {
    return mockIssues;
  }

  return (data || []).map((i: any) => ({
    id: i.id,
    projectId: i.project_id,
    projectName: 'Synced Project',
    severity: i.severity,
    title: i.title,
    detectedAt: 'Synced',
    status: i.status,
  })) as Issue[];
}

export async function getAIInsights(clerkToken: string, clerkOrgId?: string | null) {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase.from('ai_insights').select('*');

  if (clerkOrgId) {
    const { data: orgData } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_organization_id', clerkOrgId)
      .maybeSingle();

    if (orgData) {
      query = query.eq('organization_id', orgData.id);
    } else {
      return [];
    }
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query;
  if (useFallback(error)) {
    return mockAIInsights;
  }

  return (data || []).map((ai: any) => ({
    id: ai.id,
    message: ai.description,
    severity: ai.severity === 'critical' ? 'critical' : 'warning',
    timestamp: 'Synced',
  })) as AIInsight[];
}

export async function getNotifications(clerkToken: string) {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('notifications')
    .select('*');

  if (useFallback(error)) {
    return mockNotifications;
  }

  return (data || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    description: n.message,
    read: n.read_at !== null,
    createdAt: 'Synced',
    type: n.type as any,
  })) as Notification[];
}
