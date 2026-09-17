// ==============================================================================
// Sculra Production Server-Side Database Service Layer (frontend/services/db.ts)
// ==============================================================================
// Unified query/mutation interfaces extracting tables securely.
// Utilizes getSupabaseUserClient to verify Clerk token authorization at the DB RLS layer.

import { getSupabaseUserClient } from '../lib/supabase';
import { Project, TestRun, Issue, AIInsight, Notification, TestEvidence, ReleaseScore, QASignalRecord, Campaign, CampaignTask, CICDWebhookEvent, CICDGateResult, mockProjects, mockTestRuns, mockIssues, mockAIInsights, mockNotifications, mockTestEvidence, mockCampaigns, mockCampaignTasks } from '../lib/demoData';

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
    ciEnabled: !!data.ci_enabled,
    githubRepoOwner: data.github_repo_owner || undefined,
    githubRepoName: data.github_repo_name || undefined,
    ciDefaultBranch: data.ci_default_branch || 'main',
    ciTriggerOnPush: data.ci_trigger_on_push !== false,
    ciTriggerOnPr: data.ci_trigger_on_pr !== false,
    ciGatePolicy: data.ci_gate_policy || 'BLOCK_ON_CRITICAL_ISSUE',
    ciWebhookSecret: data.ci_webhook_secret || undefined,
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
    releaseScore: r.overall_score ?? null,
    durationMs: r.duration_ms || 0,
    createdAt: 'Synced',
  })) as TestRun[];
}

export async function getIssues(clerkToken: string, clerkOrgId?: string | null) {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase.from('issues').select('*, projects(name)').order('last_seen_at', { ascending: false });

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
    projectName: i.projects?.name || 'Sculra Project',
    severity: i.severity || 'medium',
    title: i.title,
    description: i.description,
    detectedAt: i.last_seen_at ? new Date(i.last_seen_at).toLocaleDateString() : 'Recent',
    status: i.status || 'open',
    fingerprint: i.fingerprint,
    occurrenceCount: i.occurrence_count || 1,
    firstSeenAt: i.first_seen_at,
    lastSeenAt: i.last_seen_at,
    reproductionSteps: i.metadata?.reproductionSteps,
    metadata: i.metadata,
  })) as Issue[];
}

export async function getTestRunIssues(clerkToken: string, testRunId: string): Promise<Issue[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('issues')
    .select('*, projects(name)')
    .eq('test_run_id', testRunId)
    .order('created_at', { ascending: true });

  if (useFallback(error)) {
    return [];
  }

  return (data || []).map((i: any) => ({
    id: i.id,
    projectId: i.project_id,
    projectName: i.projects?.name || 'Sculra Project',
    severity: i.severity || 'medium',
    title: i.title,
    description: i.description,
    detectedAt: i.last_seen_at ? new Date(i.last_seen_at).toLocaleTimeString() : 'Recent',
    status: i.status || 'open',
    fingerprint: i.fingerprint,
    occurrenceCount: i.occurrence_count || 1,
    firstSeenAt: i.first_seen_at,
    lastSeenAt: i.last_seen_at,
    reproductionSteps: i.metadata?.reproductionSteps,
    metadata: i.metadata,
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

export async function getTestRun(clerkToken: string, id: string): Promise<TestRun | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('test_runs')
    .select('*, projects(name, source_url, repository_url, source_type)')
    .eq('id', id)
    .maybeSingle();

  if (useFallback(error)) {
    const mock = mockTestRuns.find((r) => r.id === id);
    return mock || null;
  }

  if (!data) return null;

  const proj = data.projects;
  return {
    id: data.id,
    projectId: data.project_id,
    projectName: proj?.name || 'Synced Project',
    status: data.status,
    issuesCount: 0,
    releaseScore: data.overall_score ?? null,
    durationMs: data.duration_ms || 0,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleString() : 'Synced',
    startedAt: data.started_at ? new Date(data.started_at).toLocaleString() : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at).toLocaleString() : undefined,
    url: proj?.source_url || proj?.repository_url,
  };
}

export async function getTestEvidence(clerkToken: string, testRunId: string): Promise<TestEvidence[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('test_evidence')
    .select('*')
    .eq('test_run_id', testRunId)
    .order('created_at', { ascending: true });

  if (useFallback(error)) {
    return mockTestEvidence.filter((e) => e.testRunId === testRunId);
  }

  return (data || []).map((e: any) => ({
    id: e.id,
    testRunId: e.test_run_id,
    projectId: e.project_id,
    type: e.type,
    title: e.title,
    url: e.url,
    message: e.message,
    metadata: e.metadata,
    storagePath: e.storage_path,
    createdAt: e.created_at ? new Date(e.created_at).toLocaleTimeString() : 'Synced',
  }));
}

export async function createTestRun(
  clerkToken: string,
  runData: {
    projectId: string;
    clerkUserId: string;
    clerkOrgId?: string | null;
    triggerType?: 'manual' | 'github' | 'scheduled' | 'api';
  }
): Promise<{ id: string; status: string }> {
  const supabase = getSupabaseUserClient(clerkToken);
  let internalOrgId: string | null = null;

  if (runData.clerkOrgId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('clerk_organization_id', runData.clerkOrgId)
      .maybeSingle();
    if (org) {
      internalOrgId = org.id;
    }
  }

  const { data, error } = await supabase
    .from('test_runs')
    .insert({
      project_id: runData.projectId,
      organization_id: internalOrgId,
      status: 'queued',
      trigger_type: runData.triggerType || 'manual',
      created_by: runData.clerkUserId,
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    status: data.status,
  };
}

export async function cancelTestRun(clerkToken: string, testRunId: string): Promise<boolean> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { error } = await supabase
    .from('test_runs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', testRunId);

  if (error) {
    throw error;
  }

  return true;
}

export async function getReleaseScore(clerkToken: string, testRunId: string): Promise<ReleaseScore | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('release_scores')
    .select('*')
    .eq('test_run_id', testRunId)
    .maybeSingle();

  if (useFallback(error) || !data) {
    return null;
  }

  return {
    id: data.id,
    testRunId: data.test_run_id,
    projectId: data.project_id,
    organizationId: data.organization_id,
    overallScore: data.overall_score,
    functionalityScore: data.functionality_score,
    uiScore: data.ui_score,
    responsiveScore: data.responsive_score ?? 0,
    reliabilityScore: data.reliability_score ?? (data.performance_score || 0),
    coverageScore: data.coverage_score ?? 0,
    securityScore: typeof data.security_score === 'number' ? data.security_score : undefined,
    performanceScore: typeof data.performance_score === 'number' ? data.performance_score : undefined,
    accessibilityScore: typeof data.accessibility_score === 'number' ? data.accessibility_score : undefined,
    recommendation: data.recommendation || 'DO_NOT_RELEASE',
    riskLevel: data.risk_level || 'UNKNOWN',
    confidenceLevel: data.confidence_level || 'LOW',
    scoringVersion: data.scoring_version || '1.0',
    blockersCount: data.blockers_count || 0,
    breakdown: data.breakdown,
    blockers: data.blockers || [],
    aiAnalysis: data.ai_analysis,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleString() : '',
  };
}

export async function getLatestReleaseScore(clerkToken: string, projectId: string): Promise<ReleaseScore | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('release_scores')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (useFallback(error) || !data) {
    return null;
  }

  return {
    id: data.id,
    testRunId: data.test_run_id,
    projectId: data.project_id,
    organizationId: data.organization_id,
    overallScore: data.overall_score,
    functionalityScore: data.functionality_score,
    uiScore: data.ui_score,
    responsiveScore: data.responsive_score,
    reliabilityScore: data.reliability_score ?? (data.performance_score || 0),
    coverageScore: data.coverage_score ?? 0,
    securityScore: typeof data.security_score === 'number' ? data.security_score : undefined,
    performanceScore: typeof data.performance_score === 'number' ? data.performance_score : undefined,
    accessibilityScore: typeof data.accessibility_score === 'number' ? data.accessibility_score : undefined,
    recommendation: data.recommendation || 'DO_NOT_RELEASE',
    riskLevel: data.risk_level || 'UNKNOWN',
    confidenceLevel: data.confidence_level || 'LOW',
    scoringVersion: data.scoring_version || '1.0',
    blockersCount: data.blockers_count || 0,
    breakdown: data.breakdown,
    blockers: data.blockers || [],
    aiAnalysis: data.ai_analysis,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleString() : '',
  };
}

export async function getProjectReleaseHistory(clerkToken: string, projectId: string): Promise<ReleaseScore[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('release_scores')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((d: any) => ({
    id: d.id,
    testRunId: d.test_run_id,
    projectId: d.project_id,
    organizationId: d.organization_id,
    overallScore: d.overall_score,
    functionalityScore: d.functionality_score,
    uiScore: d.ui_score,
    responsiveScore: d.responsive_score,
    reliabilityScore: d.reliability_score ?? (d.performance_score || 0),
    coverageScore: d.coverage_score ?? 0,
    securityScore: typeof d.security_score === 'number' ? d.security_score : undefined,
    performanceScore: typeof d.performance_score === 'number' ? d.performance_score : undefined,
    accessibilityScore: typeof d.accessibility_score === 'number' ? d.accessibility_score : undefined,
    recommendation: d.recommendation || 'DO_NOT_RELEASE',
    riskLevel: d.risk_level || 'UNKNOWN',
    confidenceLevel: d.confidence_level || 'LOW',
    scoringVersion: d.scoring_version || '1.0',
    blockersCount: d.blockers_count || 0,
    breakdown: d.breakdown,
    blockers: d.blockers || [],
    aiAnalysis: d.ai_analysis,
    createdAt: d.created_at ? new Date(d.created_at).toLocaleString() : '',
  }));
}

export async function getProjectHistorySignals(
  clerkToken: string,
  projectId: string,
  limit = 50
): Promise<QASignalRecord[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('qa_history_signals')
    .select('*')
    .eq('project_id', projectId)
    .order('last_seen_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((s: any) => ({
    id: s.id,
    projectId: s.project_id,
    organizationId: s.organization_id,
    testRunId: s.test_run_id,
    signalType: s.signal_type,
    targetType: s.target_type,
    targetIdentifier: s.target_identifier,
    fingerprint: s.fingerprint,
    severity: s.severity,
    confidence: s.confidence,
    occurrenceCount: s.occurrence_count || 1,
    consecutiveCount: s.consecutive_count || 1,
    environment: s.environment,
    viewport: s.viewport,
    role: s.role,
    metadata: s.metadata || {},
    firstSeenAt: s.first_seen_at ? new Date(s.first_seen_at).toLocaleString() : '',
    lastSeenAt: s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '',
    createdAt: s.created_at ? new Date(s.created_at).toLocaleString() : '',
  }));
}

export async function getTestRunHistorySignals(
  clerkToken: string,
  testRunId: string
): Promise<QASignalRecord[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('qa_history_signals')
    .select('*')
    .eq('test_run_id', testRunId)
    .order('created_at', { ascending: false });

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((s: any) => ({
    id: s.id,
    projectId: s.project_id,
    organizationId: s.organization_id,
    testRunId: s.test_run_id,
    signalType: s.signal_type,
    targetType: s.target_type,
    targetIdentifier: s.target_identifier,
    fingerprint: s.fingerprint,
    severity: s.severity,
    confidence: s.confidence,
    occurrenceCount: s.occurrence_count || 1,
    consecutiveCount: s.consecutive_count || 1,
    environment: s.environment,
    viewport: s.viewport,
    role: s.role,
    metadata: s.metadata || {},
    firstSeenAt: s.first_seen_at ? new Date(s.first_seen_at).toLocaleString() : '',
    lastSeenAt: s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : '',
    createdAt: s.created_at ? new Date(s.created_at).toLocaleString() : '',
  }));
}

export async function getTestRunHistoricalEvidence(
  clerkToken: string,
  testRunId: string
): Promise<TestEvidence[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('test_evidence')
    .select('*')
    .eq('test_run_id', testRunId)
    .in('type', [
      'historical_summary',
      'regression_event',
      'recovery_event',
      'recurrence_event',
      'stability_signal',
      'trend_snapshot',
      'coverage_trend',
      'historical_comparison',
    ])
    .order('created_at', { ascending: true });

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((e: any) => ({
    id: e.id,
    testRunId: e.test_run_id,
    projectId: e.project_id,
    type: e.type,
    title: e.title,
    url: e.url,
    message: e.message,
    metadata: e.metadata,
    storagePath: e.storage_path,
    createdAt: e.created_at ? new Date(e.created_at).toLocaleString() : '',
  }));
}

// ------------------------------------------------------------------------------
// Autonomous QA Campaign Service Methods
// ------------------------------------------------------------------------------

export async function createCampaign(
  clerkToken: string,
  projectId: string,
  config: Record<string, any>
): Promise<Campaign> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('qa_campaigns')
    .insert({
      project_id: projectId,
      name: config.name || 'Autonomous QA Campaign',
      objective: config.objective || 'RELEASE_GATE',
      status: 'PENDING',
      current_stage: 'DISCOVERY_MAPPING',
      config,
      budget_status: {
        durationSeconds: { current: 0, max: config.budget?.maxDurationSeconds || 900, exhausted: false },
        tasks: { totalPlanned: 0, completed: 0, running: 0, failed: 0, skipped: 0, max: config.budget?.maxTasks || 25, exhausted: false },
        retries: { count: 0, maxPerTask: config.budget?.maxRetriesPerTask || 1 },
        overallExhausted: false,
      },
      progress_snapshot: {
        status: 'PENDING',
        currentStage: 'DISCOVERY_MAPPING',
        activeTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalTasks: 0,
        percentComplete: 0,
        elapsedDurationMs: 0,
        coverage: {
          pagesDiscovered: 0,
          pagesTested: 0,
          endpointsDiscovered: 0,
          endpointsTested: 0,
          criticalWorkflowsTotal: 0,
          criticalWorkflowsTested: 0,
          rolesTested: 0,
          domainCoveragePercentage: {},
        },
      },
    })
    .select('*')
    .single();

  if (useFallback(error) || !data) {
    return {
      id: `camp-mock-${Date.now()}`,
      projectId,
      name: config.name || 'Autonomous QA Campaign',
      objective: config.objective || 'RELEASE_GATE',
      status: 'PENDING',
      currentStage: 'DISCOVERY_MAPPING',
      config: config as any,
      budgetStatus: {},
      progressSnapshot: {
        campaignId: `camp-mock-${Date.now()}`,
        status: 'PENDING',
        currentStage: 'DISCOVERY_MAPPING',
        activeTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        totalTasks: 0,
        percentComplete: 0,
        elapsedDurationMs: 0,
        coverage: {
          pagesDiscovered: 0,
          pagesTested: 0,
          endpointsDiscovered: 0,
          endpointsTested: 0,
          criticalWorkflowsTotal: 0,
          criticalWorkflowsTested: 0,
          rolesTested: 0,
          domainCoveragePercentage: {} as any,
        },
        budget: {
          durationSeconds: { current: 0, max: config.budget?.maxDurationSeconds || 900, exhausted: false },
          tasks: { totalPlanned: 0, completed: 0, running: 0, failed: 0, skipped: 0, max: config.budget?.maxTasks || 25, exhausted: false },
          retries: { count: 0, maxPerTask: 1 },
          overallExhausted: false,
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    id: data.id,
    projectId: data.project_id,
    organizationId: data.organization_id,
    name: data.name,
    objective: data.objective,
    status: data.status,
    currentStage: data.current_stage,
    config: data.config,
    budgetStatus: data.budget_status || {},
    progressSnapshot: data.progress_snapshot || {},
    summary: data.summary,
    overallScore: data.overall_score !== null && data.overall_score !== undefined ? Number(data.overall_score) : undefined,
    releaseVerdict: data.release_verdict,
    errorMessage: data.error_message,
    startedAt: data.started_at ? new Date(data.started_at).toLocaleString() : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at).toLocaleString() : undefined,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleString() : '',
    updatedAt: data.updated_at ? new Date(data.updated_at).toLocaleString() : '',
  };
}

export async function getCampaign(
  clerkToken: string,
  campaignId: string
): Promise<Campaign | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('qa_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (useFallback(error) || !data) {
    const found = mockCampaigns.find((c) => c.id === campaignId);
    return found || null;
  }

  return {
    id: data.id,
    projectId: data.project_id,
    organizationId: data.organization_id,
    name: data.name,
    objective: data.objective,
    status: data.status,
    currentStage: data.current_stage,
    config: data.config,
    budgetStatus: data.budget_status || {},
    progressSnapshot: data.progress_snapshot || {},
    summary: data.summary,
    overallScore: data.overall_score !== null && data.overall_score !== undefined ? Number(data.overall_score) : undefined,
    releaseVerdict: data.release_verdict,
    errorMessage: data.error_message,
    startedAt: data.started_at ? new Date(data.started_at).toLocaleString() : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at).toLocaleString() : undefined,
    createdAt: data.created_at ? new Date(data.created_at).toLocaleString() : '',
    updatedAt: data.updated_at ? new Date(data.updated_at).toLocaleString() : '',
  };
}

export async function getProjectCampaigns(
  clerkToken: string,
  projectId: string
): Promise<Campaign[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('qa_campaigns')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (useFallback(error) || !data) {
    return mockCampaigns.filter((c) => c.projectId === projectId);
  }

  return data.map((c: any) => ({
    id: c.id,
    projectId: c.project_id,
    organizationId: c.organization_id,
    name: c.name,
    objective: c.objective,
    status: c.status,
    currentStage: c.current_stage,
    config: c.config,
    budgetStatus: c.budget_status || {},
    progressSnapshot: c.progress_snapshot || {},
    summary: c.summary,
    overallScore: c.overall_score !== null && c.overall_score !== undefined ? Number(c.overall_score) : undefined,
    releaseVerdict: c.release_verdict,
    errorMessage: c.error_message,
    startedAt: c.started_at ? new Date(c.started_at).toLocaleString() : undefined,
    completedAt: c.completed_at ? new Date(c.completed_at).toLocaleString() : undefined,
    createdAt: c.created_at ? new Date(c.created_at).toLocaleString() : '',
    updatedAt: c.updated_at ? new Date(c.updated_at).toLocaleString() : '',
  }));
}

export async function getCampaignTasks(
  clerkToken: string,
  campaignId: string
): Promise<CampaignTask[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('qa_campaign_tasks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  if (useFallback(error) || !data) {
    return mockCampaignTasks.filter((t) => t.campaignId === campaignId);
  }

  return data.map((t: any) => ({
    id: t.id,
    campaignId: t.campaign_id,
    taskKey: t.task_key,
    stage: t.stage,
    domain: t.domain,
    status: t.status,
    priority: t.priority,
    target: t.target,
    dependencies: t.dependencies || [],
    retryCount: t.retry_count || 0,
    maxRetries: t.max_retries || 1,
    startedAt: t.started_at ? new Date(t.started_at).toLocaleString() : undefined,
    completedAt: t.completed_at ? new Date(t.completed_at).toLocaleString() : undefined,
    durationMs: t.duration_ms,
    error: t.error,
    observationsCount: t.observations_count || 0,
    issuesDetected: t.issues_detected || 0,
    metadata: t.metadata || {},
    createdAt: t.created_at ? new Date(t.created_at).toLocaleString() : '',
  }));
}

export async function getCampaignEvidence(
  clerkToken: string,
  campaignId: string
): Promise<TestEvidence[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('test_evidence')
    .select('*')
    .eq('metadata->>campaignId', campaignId)
    .order('created_at', { ascending: true });

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((e: any) => ({
    id: e.id,
    testRunId: e.test_run_id,
    projectId: e.project_id,
    type: e.type,
    title: e.title,
    url: e.url,
    message: e.message,
    metadata: e.metadata,
    storagePath: e.storage_path,
    createdAt: e.created_at ? new Date(e.created_at).toLocaleString() : '',
  }));
}

export async function cancelCampaign(
  clerkToken: string,
  campaignId: string
): Promise<void> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { error } = await supabase
    .from('qa_campaigns')
    .update({
      status: 'CANCELLED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId);

  if (error && !useFallback(error)) {
    throw new Error(`Failed to cancel campaign: ${error.message}`);
  }
}

// ------------------------------------------------------------------------------
// CI/CD QA Gates & Integration Service Methods
// ------------------------------------------------------------------------------

export async function getProjectCIConfig(
  clerkToken: string,
  projectId: string
) {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      organization_id,
      name,
      ci_enabled,
      github_repo_owner,
      github_repo_name,
      ci_default_branch,
      ci_trigger_on_push,
      ci_trigger_on_pr,
      ci_gate_policy,
      ci_webhook_secret,
      source_url,
      repository_url
    `)
    .eq('id', projectId)
    .maybeSingle();

  if (useFallback(error) || !data) {
    return {
      projectId,
      ciEnabled: false,
      githubRepoOwner: '',
      githubRepoName: '',
      ciDefaultBranch: 'main',
      ciTriggerOnPush: true,
      ciTriggerOnPr: true,
      ciGatePolicy: 'BLOCK_ON_CRITICAL_ISSUE' as const,
      ciWebhookSecret: 'sec_' + Math.random().toString(36).slice(2, 10),
    };
  }

  return {
    projectId: data.id,
    organizationId: data.organization_id,
    name: data.name,
    ciEnabled: !!data.ci_enabled,
    githubRepoOwner: data.github_repo_owner || '',
    githubRepoName: data.github_repo_name || '',
    ciDefaultBranch: data.ci_default_branch || 'main',
    ciTriggerOnPush: data.ci_trigger_on_push !== false,
    ciTriggerOnPr: data.ci_trigger_on_pr !== false,
    ciGatePolicy: data.ci_gate_policy || 'BLOCK_ON_CRITICAL_ISSUE',
    ciWebhookSecret: data.ci_webhook_secret || '',
    sourceUrl: data.source_url,
    repositoryUrl: data.repository_url,
  };
}

export async function updateProjectCIConfig(
  clerkToken: string,
  projectId: string,
  updates: {
    ciEnabled?: boolean;
    githubRepoOwner?: string;
    githubRepoName?: string;
    ciDefaultBranch?: string;
    ciTriggerOnPush?: boolean;
    ciTriggerOnPr?: boolean;
    ciGatePolicy?: 'BLOCK_ON_CRITICAL_ISSUE' | 'STRICT' | 'PERMISSIVE' | 'BLOCK_ON_REGRESSION';
    ciWebhookSecret?: string;
  }
) {
  const supabase = getSupabaseUserClient(clerkToken);
  const dbUpdates: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.ciEnabled !== undefined) dbUpdates.ci_enabled = updates.ciEnabled;
  if (updates.githubRepoOwner !== undefined) dbUpdates.github_repo_owner = updates.githubRepoOwner.trim();
  if (updates.githubRepoName !== undefined) dbUpdates.github_repo_name = updates.githubRepoName.trim();
  if (updates.ciDefaultBranch !== undefined) dbUpdates.ci_default_branch = updates.ciDefaultBranch.trim();
  if (updates.ciTriggerOnPush !== undefined) dbUpdates.ci_trigger_on_push = updates.ciTriggerOnPush;
  if (updates.ciTriggerOnPr !== undefined) dbUpdates.ci_trigger_on_pr = updates.ciTriggerOnPr;
  if (updates.ciGatePolicy !== undefined) dbUpdates.ci_gate_policy = updates.ciGatePolicy;
  if (updates.ciWebhookSecret !== undefined) dbUpdates.ci_webhook_secret = updates.ciWebhookSecret.trim();

  const { data, error } = await supabase
    .from('projects')
    .update(dbUpdates)
    .eq('id', projectId)
    .select('*')
    .single();

  if (error && !useFallback(error)) {
    throw new Error(`Failed to update project CI configuration: ${error.message}`);
  }

  return data;
}

export async function getCICDWebhookEvents(
  clerkToken: string,
  projectId: string,
  limit = 20
): Promise<CICDWebhookEvent[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('cicd_webhook_events')
    .select('*')
    .eq('project_id', projectId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((e: any) => ({
    id: e.id,
    deliveryId: e.delivery_id,
    provider: e.provider,
    eventType: e.event_type,
    projectId: e.project_id,
    repository: e.repository,
    commitSha: e.commit_sha,
    pullRequestNumber: e.pull_request_number,
    status: e.status,
    campaignId: e.campaign_id,
    errorCode: e.error_code,
    receivedAt: e.received_at,
    processedAt: e.processed_at,
  }));
}

export async function getCICDGateResults(
  clerkToken: string,
  projectId: string,
  limit = 20
): Promise<CICDGateResult[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('cicd_gate_results')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    campaignId: r.campaign_id,
    testRunId: r.test_run_id,
    projectId: r.project_id,
    commitSha: r.commit_sha,
    pullRequestNumber: r.pull_request_number,
    branch: r.branch,
    gateVerdict: r.gate_verdict,
    gatePolicy: r.gate_policy,
    releaseVerdict: r.release_verdict,
    reasonCodes: r.reason_codes || [],
    criticalFindingsCount: r.critical_findings_count || 0,
    regressionCount: r.regression_count || 0,
    evidenceStatus: r.evidence_status,
    summaryMarkdown: r.summary_markdown,
    feedbackJson: r.feedback_json || {},
    createdAt: r.created_at,
  }));
}



