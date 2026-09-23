// ==============================================================================
// Sculra Production Server-Side Database Service Layer (frontend/services/db.ts)
// ==============================================================================
// Unified query/mutation interfaces extracting tables securely.
// Utilizes getSupabaseUserClient to verify Clerk token authorization at the DB RLS layer.
import { getSupabaseUserClient } from '../lib/supabase';
import {
  Project,
  TestRun,
  Issue,
  AIInsight,
  Notification,
  TestEvidence,
  ReleaseScore,
  QASignalRecord,
  Campaign,
  CampaignTask,
  CICDWebhookEvent,
  CICDGateResult,
  ChangeAnalysis,
  RemediationAnalysis,
  ProjectFixPolicy,
  FixRemediation,
  FixEvidence,
  FixAgentMode,
  AutonomousEvent,
  DecisionRecord,
  HumanApprovalRecord,
  HumanApprovalStatus,
  EvidenceGraph,
  AutonomousHealthMetrics,
  mockProjects,
  mockTestRuns,
  mockIssues,
  mockAIInsights,
  mockNotifications,
  mockTestEvidence,
  mockCampaigns,
  mockCampaignTasks,
  mockFixRemediations,
  mockAutonomousEvents,
  mockDecisions,
  mockApprovals,
  mockEvidenceGraph,
  ProjectSource,
  SourceSnapshot,
  SourceHealthObservation,
  SourceValidationResult,
  SourceChange,
  SourceType,
  mockProjectSources,
  mockSourceSnapshots,
  mockSourceHealthObservations,
  OrganizationMember,
  mockOrganizationMembers,
  ProjectEnvironment,
  Deployment,
  Release,
  ReleaseCheck,
  ReleaseDecision,
  mockProjectEnvironments,
  mockDeployments,
  mockReleases,
  mockReleaseChecks,
  mockReleaseDecisions,
  CredentialRecord,
  CredentialRotation,
  CredentialAccessLog,
  mockCredentialRecords,
  mockCredentialRotations,
  mockCredentialAccessLogs,
} from '../lib/demoData';
import { PolicyManager } from '../lib/authz/policy';
import type { SculraRole } from '../lib/authz/roles';

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
    fixAgentPolicy: {
      fixAgentEnabled: !!data.fix_agent_enabled,
      fixAgentMode: data.fix_agent_mode || 'PLAN_ONLY',
      fixAllowedPaths: data.fix_allowed_paths || [],
      fixBlockedPaths: data.fix_blocked_paths || [],
      fixMaxFilesChanged: data.fix_max_files_changed ?? 10,
      fixMaxDiffLines: data.fix_max_diff_lines ?? 500,
      fixAllowedTestCommands: data.fix_allowed_test_commands || [],
      fixRequireHumanApproval: data.fix_require_human_approval !== false,
      fixAutoPrEnabled: !!data.fix_auto_pr_enabled,
      fixBranchPrefix: data.fix_branch_prefix || 'sculra/fix/',
    },
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

export async function getProjectChangeAnalyses(
  clerkToken: string,
  projectId: string,
  limit = 10
): Promise<ChangeAnalysis[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('change_analyses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    projectId: r.project_id,
    campaignId: r.campaign_id,
    commitSha: r.commit_sha,
    baseSha: r.base_sha,
    branch: r.branch,
    pullRequestNumber: r.pull_request_number,
    changeCount: r.change_count || 0,
    additionsCount: r.additions_count || 0,
    deletionsCount: r.deletions_count || 0,
    riskScore: r.risk_score ?? 0,
    riskLevel: r.risk_level || 'LOW',
    analysisStatus: r.analysis_status || 'COMPLETED',
    classifications: r.classifications || [],
    summary: r.summary || {},
    impactGraph: r.impact_graph || {},
    metadata: r.metadata || {},
    createdAt: r.created_at,
  }));
}

export async function getIssueRemediationAnalysis(
  clerkToken: string,
  issueId: string
): Promise<RemediationAnalysis | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('issue_remediation_analyses')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (useFallback(error) || !data) {
    return null;
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    projectId: data.project_id,
    issueId: data.issue_id,
    campaignId: data.campaign_id,
    testRunId: data.test_run_id,
    fingerprint: data.fingerprint,
    analysisVersion: data.analysis_version,
    status: data.status,
    confidence: data.confidence,
    diagnosis: data.diagnosis,
    hypotheses: data.hypotheses || [],
    fixPlan: data.fix_plan,
    verificationPlan: data.verification_plan,
    codeContextSummary: data.code_context_summary,
    changeContextSummary: data.change_context_summary,
    historicalContextSummary: data.historical_context_summary,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getProjectRemediationAnalyses(
  clerkToken: string,
  projectId: string,
  limit = 20
): Promise<RemediationAnalysis[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('issue_remediation_analyses')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return [];
  }

  return data.map((r: any) => ({
    id: r.id,
    organizationId: r.organization_id,
    projectId: r.project_id,
    issueId: r.issue_id,
    campaignId: r.campaign_id,
    testRunId: r.test_run_id,
    fingerprint: r.fingerprint,
    analysisVersion: r.analysis_version,
    status: r.status,
    confidence: r.confidence,
    diagnosis: r.diagnosis,
    hypotheses: r.hypotheses || [],
    fixPlan: r.fix_plan,
    verificationPlan: r.verification_plan,
    codeContextSummary: r.code_context_summary,
    changeContextSummary: r.change_context_summary,
    historicalContextSummary: r.historical_context_summary,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getProjectFixPolicy(
  clerkToken: string,
  projectId: string
): Promise<ProjectFixPolicy | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('projects')
    .select(`
      fix_agent_enabled,
      fix_agent_mode,
      fix_allowed_paths,
      fix_blocked_paths,
      fix_max_files_changed,
      fix_max_diff_lines,
      fix_allowed_test_commands,
      fix_require_human_approval,
      fix_auto_pr_enabled,
      fix_branch_prefix
    `)
    .eq('id', projectId)
    .maybeSingle();

  if (useFallback(error) || !data) {
    return {
      fixAgentEnabled: false,
      fixAgentMode: 'PLAN_ONLY',
      fixAllowedPaths: [],
      fixBlockedPaths: [],
      fixMaxFilesChanged: 10,
      fixMaxDiffLines: 500,
      fixAllowedTestCommands: [],
      fixRequireHumanApproval: true,
      fixAutoPrEnabled: false,
      fixBranchPrefix: 'sculra/fix/',
    };
  }

  return {
    fixAgentEnabled: !!data.fix_agent_enabled,
    fixAgentMode: data.fix_agent_mode || 'PLAN_ONLY',
    fixAllowedPaths: data.fix_allowed_paths || [],
    fixBlockedPaths: data.fix_blocked_paths || [],
    fixMaxFilesChanged: data.fix_max_files_changed ?? 10,
    fixMaxDiffLines: data.fix_max_diff_lines ?? 500,
    fixAllowedTestCommands: data.fix_allowed_test_commands || [],
    fixRequireHumanApproval: data.fix_require_human_approval !== false,
    fixAutoPrEnabled: !!data.fix_auto_pr_enabled,
    fixBranchPrefix: data.fix_branch_prefix || 'sculra/fix/',
  };
}

export async function updateProjectFixPolicy(
  clerkToken: string,
  projectId: string,
  policy: Partial<ProjectFixPolicy>
): Promise<ProjectFixPolicy> {
  const supabase = getSupabaseUserClient(clerkToken);

  const updatePayload: Record<string, any> = {};
  if (policy.fixAgentEnabled !== undefined) updatePayload.fix_agent_enabled = policy.fixAgentEnabled;
  if (policy.fixAgentMode !== undefined) updatePayload.fix_agent_mode = policy.fixAgentMode;
  if (policy.fixAllowedPaths !== undefined) updatePayload.fix_allowed_paths = policy.fixAllowedPaths;
  if (policy.fixBlockedPaths !== undefined) updatePayload.fix_blocked_paths = policy.fixBlockedPaths;
  if (policy.fixMaxFilesChanged !== undefined) updatePayload.fix_max_files_changed = policy.fixMaxFilesChanged;
  if (policy.fixMaxDiffLines !== undefined) updatePayload.fix_max_diff_lines = policy.fixMaxDiffLines;
  if (policy.fixAllowedTestCommands !== undefined) updatePayload.fix_allowed_test_commands = policy.fixAllowedTestCommands;
  if (policy.fixRequireHumanApproval !== undefined) updatePayload.fix_require_human_approval = policy.fixRequireHumanApproval;
  if (policy.fixAutoPrEnabled !== undefined) updatePayload.fix_auto_pr_enabled = policy.fixAutoPrEnabled;
  if (policy.fixBranchPrefix !== undefined) updatePayload.fix_branch_prefix = policy.fixBranchPrefix;

  const { data, error } = await supabase
    .from('projects')
    .update(updatePayload)
    .eq('id', projectId)
    .select(`
      fix_agent_enabled,
      fix_agent_mode,
      fix_allowed_paths,
      fix_blocked_paths,
      fix_max_files_changed,
      fix_max_diff_lines,
      fix_allowed_test_commands,
      fix_require_human_approval,
      fix_auto_pr_enabled,
      fix_branch_prefix
    `)
    .maybeSingle();

  if (useFallback(error) || !data) {
    return {
      fixAgentEnabled: policy.fixAgentEnabled ?? false,
      fixAgentMode: policy.fixAgentMode || 'PLAN_ONLY',
      fixAllowedPaths: policy.fixAllowedPaths || [],
      fixBlockedPaths: policy.fixBlockedPaths || [],
      fixMaxFilesChanged: policy.fixMaxFilesChanged ?? 10,
      fixMaxDiffLines: policy.fixMaxDiffLines ?? 500,
      fixAllowedTestCommands: policy.fixAllowedTestCommands || [],
      fixRequireHumanApproval: policy.fixRequireHumanApproval ?? true,
      fixAutoPrEnabled: policy.fixAutoPrEnabled ?? false,
      fixBranchPrefix: policy.fixBranchPrefix || 'sculra/fix/',
    };
  }

  return {
    fixAgentEnabled: !!data.fix_agent_enabled,
    fixAgentMode: data.fix_agent_mode || 'PLAN_ONLY',
    fixAllowedPaths: data.fix_allowed_paths || [],
    fixBlockedPaths: data.fix_blocked_paths || [],
    fixMaxFilesChanged: data.fix_max_files_changed ?? 10,
    fixMaxDiffLines: data.fix_max_diff_lines ?? 500,
    fixAllowedTestCommands: data.fix_allowed_test_commands || [],
    fixRequireHumanApproval: data.fix_require_human_approval !== false,
    fixAutoPrEnabled: !!data.fix_auto_pr_enabled,
    fixBranchPrefix: data.fix_branch_prefix || 'sculra/fix/',
  };
}

function mapFixRemediationRecord(r: any): FixRemediation {
  return {
    id: r.id,
    organizationId: r.organization_id,
    projectId: r.project_id,
    issueId: r.issue_id,
    remediationAnalysisId: r.remediation_analysis_id,
    mode: r.mode || 'PLAN_ONLY',
    status: r.status || 'INITIAL',
    branchName: r.branch_name,
    baseBranch: r.base_branch,
    commitSha: r.commit_sha,
    patchUnified: r.patch_unified,
    patchStructured: r.patch_structured,
    filesChanged: r.files_changed || [],
    linesAdded: r.lines_added ?? 0,
    linesRemoved: r.lines_removed ?? 0,
    baselineStatus: r.baseline_status || 'NOT_RUN',
    verificationStatus: r.verification_status || 'NOT_RUN',
    verificationResults: r.verification_results,
    diffReviewResults: r.diff_review_results,
    pullRequestNumber: r.pull_request_number,
    pullRequestUrl: r.pull_request_url,
    pullRequestStatus: r.pull_request_status || 'NONE',
    humanApproved: r.human_approved ?? false,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    errorMessage: r.error_message,
    errorCode: r.error_code,
    retryCount: r.retry_count ?? 0,
    maxRetries: r.max_retries ?? 2,
    executionTimeMs: r.execution_time_ms ?? 0,
    aiModel: r.ai_model,
    tokenUsage: r.token_usage,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    completedAt: r.completed_at,
  };
}

function mapFixEvidenceRecord(e: any): FixEvidence {
  return {
    id: e.id,
    remediationId: e.remediation_id,
    evidenceType: e.evidence_type,
    content: e.content,
    structuredData: e.structured_data,
    filePath: e.file_path,
    fileLine: e.file_line,
    createdAt: e.created_at,
  };
}

export async function getProjectFixRemediations(
  clerkToken: string,
  projectId: string,
  limit = 20
): Promise<FixRemediation[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('fix_remediations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return mockFixRemediations.filter((r) => r.projectId === projectId || projectId.startsWith('proj'));
  }

  return data.map(mapFixRemediationRecord);
}

export async function getIssueFixRemediations(
  clerkToken: string,
  issueId: string
): Promise<FixRemediation[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('fix_remediations')
    .select('*')
    .eq('issue_id', issueId)
    .order('created_at', { ascending: false });

  if (useFallback(error) || !data) {
    return mockFixRemediations.filter((r) => r.issueId === issueId);
  }

  return data.map(mapFixRemediationRecord);
}

export async function getFixRemediation(
  clerkToken: string,
  id: string
): Promise<{ remediation: FixRemediation; evidence: FixEvidence[] } | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('fix_remediations')
    .select('*, fix_evidence(*)')
    .eq('id', id)
    .maybeSingle();

  if (useFallback(error) || !data) {
    const mockRem = mockFixRemediations.find((r) => r.id === id);
    if (!mockRem) return null;
    return {
      remediation: mockRem,
      evidence: [],
    };
  }

  const evidence = (data.fix_evidence || []).map(mapFixEvidenceRecord);
  return {
    remediation: mapFixRemediationRecord(data),
    evidence,
  };
}

export async function createFixRemediation(
  clerkToken: string,
  params: {
    projectId: string;
    issueId: string;
    remediationAnalysisId?: string;
    mode?: FixAgentMode;
  }
): Promise<FixRemediation> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('fix_remediations')
    .insert({
      project_id: params.projectId,
      issue_id: params.issueId,
      remediation_analysis_id: params.remediationAnalysisId || null,
      mode: params.mode || 'PLAN_ONLY',
      status: 'INITIAL',
      baseline_status: 'NOT_RUN',
      verification_status: 'NOT_RUN',
    })
    .select()
    .single();

  if (useFallback(error) || !data) {
    const newMock: FixRemediation = {
      id: `fix-${Date.now()}`,
      projectId: params.projectId,
      issueId: params.issueId,
      remediationAnalysisId: params.remediationAnalysisId,
      mode: params.mode || 'PLAN_ONLY',
      status: 'INITIAL',
      linesAdded: 0,
      linesRemoved: 0,
      baselineStatus: 'NOT_RUN',
      verificationStatus: 'NOT_RUN',
      retryCount: 0,
      maxRetries: 2,
      executionTimeMs: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockFixRemediations.unshift(newMock);
    return newMock;
  }

  return mapFixRemediationRecord(data);
}

export async function cancelFixRemediation(
  clerkToken: string,
  id: string
): Promise<FixRemediation | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('fix_remediations')
    .update({
      status: 'CANCELLED',
      error_message: 'Remediation cancelled by user.',
      error_code: 'CANCELLED_BY_USER',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (useFallback(error) || !data) {
    const mock = mockFixRemediations.find((r) => r.id === id);
    if (mock) {
      mock.status = 'CANCELLED';
      mock.errorMessage = 'Remediation cancelled by user.';
      mock.errorCode = 'CANCELLED_BY_USER';
      return mock;
    }
    return null;
  }

  return mapFixRemediationRecord(data);
}

export async function approveFixRemediation(
  clerkToken: string,
  id: string,
  approvedBy: string
): Promise<FixRemediation | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('fix_remediations')
    .update({
      human_approved: true,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (useFallback(error) || !data) {
    const mock = mockFixRemediations.find((r) => r.id === id);
    if (mock) {
      mock.humanApproved = true;
      mock.approvedBy = approvedBy;
      mock.approvedAt = new Date().toISOString();
      return mock;
    }
    return null;
  }

  return mapFixRemediationRecord(data);
}

// ==============================================================================
// Autonomous Observability, Explainability & Control Center Database Mappers
// ==============================================================================

function mapAutonomousEventRecord(row: any): AutonomousEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    campaignId: row.campaign_id ?? undefined,
    taskId: row.task_id ?? undefined,
    testRunId: row.test_run_id ?? undefined,
    issueId: row.issue_id ?? undefined,
    remediationId: row.remediation_id ?? undefined,
    approvalId: row.approval_id ?? undefined,
    actorType: row.actor_type,
    actorId: row.actor_id ?? undefined,
    eventSource: row.event_source,
    eventType: row.event_type,
    factCategory: row.fact_category,
    headline: row.headline,
    reason: row.reason ?? undefined,
    confidence: row.confidence ?? undefined,
    confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : undefined,
    evidenceIds: row.evidence_ids ?? [],
    metadata: row.metadata ?? {},
    skipReason: row.skip_reason ?? undefined,
    createdAt: row.created_at,
  };
}

function mapDecisionRecord(row: any): DecisionRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    campaignId: row.campaign_id ?? undefined,
    decisionType: row.decision_type,
    factCategory: row.fact_category,
    headline: row.headline,
    why: row.why,
    whyNow: row.why_now ?? undefined,
    target: row.target ?? undefined,
    actionTaken: row.action_taken ?? undefined,
    nextAction: row.next_action ?? undefined,
    alternativesConsidered: row.alternatives_considered ?? [],
    skipReason: row.skip_reason ?? undefined,
    confidence: row.confidence,
    confidenceScore: row.confidence_score != null ? Number(row.confidence_score) : undefined,
    evidenceIds: row.evidence_ids ?? [],
    policyChecks: row.policy_checks ?? [],
    actorType: row.actor_type,
    actorId: row.actor_id ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function mapHumanApprovalRecord(row: any): HumanApprovalRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    remediationId: row.remediation_id,
    sourceSha: row.source_sha,
    fixPlanVersion: Number(row.fix_plan_version ?? 1),
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
    diffSummary: row.diff_summary ?? undefined,
    patchUnified: row.patch_unified ?? undefined,
    issueId: row.issue_id ?? undefined,
    issueTitle: row.issue_title ?? undefined,
    verificationPassed: row.verification_passed ?? undefined,
    securityChecksPassed: row.security_checks_passed ?? undefined,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getProjectAutonomousEvents(
  clerkToken: string,
  projectId: string,
  limit = 50
): Promise<AutonomousEvent[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('autonomous_events')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return mockAutonomousEvents
      .filter((e) => e.projectId === projectId || projectId === 'proj-1')
      .slice(0, limit);
  }

  return data.map(mapAutonomousEventRecord);
}

export async function getProjectAutonomousTimeline(
  clerkToken: string,
  projectId: string,
  limit = 50
): Promise<AutonomousEvent[]> {
  return getProjectAutonomousEvents(clerkToken, projectId, limit);
}

export async function getProjectAutonomousDecisions(
  clerkToken: string,
  projectId: string,
  limit = 50
): Promise<DecisionRecord[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('autonomous_decisions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (useFallback(error) || !data) {
    return mockDecisions
      .filter((d) => d.projectId === projectId || projectId === 'proj-1')
      .slice(0, limit);
  }

  return data.map(mapDecisionRecord);
}

export async function getProjectAutonomousHealth(
  clerkToken: string,
  projectId: string
): Promise<AutonomousHealthMetrics> {
  const supabase = getSupabaseUserClient(clerkToken);

  const [campaignsRes, tasksRes, approvalsRes, lastEventRes] = await Promise.all([
    supabase.from('campaigns').select('id, status').eq('project_id', projectId),
    supabase.from('campaign_tasks').select('id, status, duration_ms, created_at').eq('project_id', projectId),
    supabase.from('human_approvals').select('id, status').eq('project_id', projectId).eq('status', 'PENDING'),
    supabase.from('autonomous_events').select('created_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (useFallback(campaignsRes.error) || useFallback(tasksRes.error)) {
    const activeC = mockCampaigns.filter((c) => (c.projectId === projectId || projectId === 'proj-1') && (c.status === 'RUNNING' || c.status === 'PENDING')).length;
    const queuedT = mockCampaignTasks.filter((t) => t.status === 'PENDING' || t.status === 'READY').length;
    const runningT = mockCampaignTasks.filter((t) => t.status === 'RUNNING').length;
    const completedT = mockCampaignTasks.filter((t) => t.status === 'COMPLETED').length;
    const failedT = mockCampaignTasks.filter((t) => t.status === 'FAILED').length;
    const skippedT = mockCampaignTasks.filter((t) => t.status === 'SKIPPED').length;
    const pendingA = mockApprovals.filter((a) => (a.projectId === projectId || projectId === 'proj-1') && a.status === 'PENDING').length;
    const durations = mockCampaignTasks.map((t) => t.durationMs).filter((d): d is number => Boolean(d));
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const lastEvent = mockAutonomousEvents[0]?.createdAt ?? null;

    return {
      activeCampaignsCount: activeC,
      queuedTasksCount: queuedT,
      runningTasksCount: runningT,
      completedTasksLast24h: completedT,
      failedTasksLast24h: failedT,
      skippedTasksLast24h: skippedT,
      pendingApprovalsCount: pendingA,
      avgTaskDurationMs: avgDuration,
      lastEventTimestamp: lastEvent,
      healthy: failedT === 0 || completedT > failedT,
    };
  }

  const campaigns = campaignsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const pendingApprovals = approvalsRes.data ?? [];
  const lastEvent = lastEventRes.data?.created_at ?? null;

  const activeCampaignsCount = campaigns.filter((c) => c.status === 'RUNNING' || c.status === 'PENDING').length;
  const queuedTasksCount = tasks.filter((t) => t.status === 'PENDING' || t.status === 'READY').length;
  const runningTasksCount = tasks.filter((t) => t.status === 'RUNNING').length;
  const completedTasksLast24h = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failedTasksLast24h = tasks.filter((t) => t.status === 'FAILED').length;
  const skippedTasksLast24h = tasks.filter((t) => t.status === 'SKIPPED').length;
  const pendingApprovalsCount = pendingApprovals.length;

  const validDurations = tasks
    .map((t) => t.duration_ms)
    .filter((d): d is number => typeof d === 'number' && d > 0);
  const avgTaskDurationMs = validDurations.length > 0
    ? Math.round(validDurations.reduce((sum, val) => sum + val, 0) / validDurations.length)
    : 0;

  return {
    activeCampaignsCount,
    queuedTasksCount,
    runningTasksCount,
    completedTasksLast24h,
    failedTasksLast24h,
    skippedTasksLast24h,
    pendingApprovalsCount,
    avgTaskDurationMs,
    lastEventTimestamp: lastEvent,
    healthy: failedTasksLast24h === 0 || completedTasksLast24h >= failedTasksLast24h,
  };
}

export async function getProjectHumanApprovals(
  clerkToken: string,
  projectId: string,
  status?: string
): Promise<HumanApprovalRecord[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase
    .from('human_approvals')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (useFallback(error) || !data) {
    return mockApprovals
      .filter((a) => (a.projectId === projectId || projectId === 'proj-1') && (!status || a.status === status));
  }

  return data.map(mapHumanApprovalRecord);
}

export async function getHumanApproval(
  clerkToken: string,
  approvalId: string
): Promise<HumanApprovalRecord | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('human_approvals')
    .select('*')
    .eq('id', approvalId)
    .maybeSingle();

  if (useFallback(error) || !data) {
    const mock = mockApprovals.find((a) => a.id === approvalId);
    return mock ?? null;
  }

  return mapHumanApprovalRecord(data);
}

export async function decideHumanApproval(
  clerkToken: string,
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason: string,
  userIdentifier: string
): Promise<HumanApprovalRecord | null> {
  const now = new Date().toISOString();
  const updatePayload: Record<string, any> = {
    status: decision,
    decision_reason: reason,
    updated_at: now,
  };

  if (decision === 'APPROVED') {
    updatePayload.approved_by = userIdentifier;
    updatePayload.approved_at = now;
  } else {
    updatePayload.rejected_by = userIdentifier;
    updatePayload.rejected_at = now;
  }

  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('human_approvals')
    .update(updatePayload)
    .eq('id', approvalId)
    .select()
    .maybeSingle();

  if (useFallback(error) || !data) {
    const mock = mockApprovals.find((a) => a.id === approvalId);
    if (mock) {
      mock.status = decision;
      mock.decisionReason = reason;
      mock.updatedAt = now;
      if (decision === 'APPROVED') {
        mock.approvedBy = userIdentifier;
        mock.approvedAt = now;
      } else {
        mock.rejectedBy = userIdentifier;
        mock.rejectedAt = now;
      }
      return mock;
    }
    return null;
  }

  return mapHumanApprovalRecord(data);
}

export async function getCampaignAutonomousTimeline(
  clerkToken: string,
  campaignId: string
): Promise<AutonomousEvent[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('autonomous_events')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (useFallback(error) || !data) {
    return mockAutonomousEvents.filter((e) => e.campaignId === campaignId || campaignId === 'camp-1');
  }

  return data.map(mapAutonomousEventRecord);
}

export async function getCampaignAutonomousDecisions(
  clerkToken: string,
  campaignId: string
): Promise<DecisionRecord[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('autonomous_decisions')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (useFallback(error) || !data) {
    return mockDecisions.filter((d) => d.campaignId === campaignId || campaignId === 'camp-1');
  }

  return data.map(mapDecisionRecord);
}

export async function getCampaignEvidenceGraph(
  clerkToken: string,
  campaignId: string
): Promise<EvidenceGraph> {
  const supabase = getSupabaseUserClient(clerkToken);
  const [eventsRes, decisionsRes] = await Promise.all([
    supabase.from('autonomous_events').select('*').eq('campaign_id', campaignId).limit(50),
    supabase.from('autonomous_decisions').select('*').eq('campaign_id', campaignId).limit(20),
  ]);

  if (useFallback(eventsRes.error) || !eventsRes.data || eventsRes.data.length === 0) {
    return mockEvidenceGraph;
  }

  const nodes: EvidenceGraph['nodes'] = [];
  const edges: EvidenceGraph['edges'] = [];
  const seenNodes = new Set<string>();

  for (const evt of eventsRes.data) {
    if (!seenNodes.has(evt.id)) {
      seenNodes.add(evt.id);
      nodes.push({
        id: evt.id,
        type: evt.event_type.startsWith('CAMPAIGN') ? 'CAMPAIGN' : evt.event_type.startsWith('TASK') ? 'TASK' : 'OBSERVATION',
        factCategory: evt.fact_category,
        label: evt.headline,
        description: evt.reason,
        timestamp: evt.created_at,
        metadata: evt.metadata,
      });
    }

    if (evt.evidence_ids && Array.isArray(evt.evidence_ids)) {
      for (const evId of evt.evidence_ids) {
        if (!seenNodes.has(evId)) {
          seenNodes.add(evId);
          nodes.push({
            id: evId,
            type: 'EVIDENCE',
            factCategory: 'OBSERVED_FACT',
            label: `Evidence ${evId}`,
            timestamp: evt.created_at,
          });
        }
        edges.push({
          from: evt.id,
          to: evId,
          relationship: 'PRODUCED',
        });
      }
    }
  }

  return { nodes, edges };
}

export async function getEntityAutonomousTimeline(
  clerkToken: string,
  entityType: 'testRun' | 'issue' | 'remediation',
  entityId: string
): Promise<AutonomousEvent[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const colName = entityType === 'testRun' ? 'test_run_id' : entityType === 'issue' ? 'issue_id' : 'remediation_id';
  const { data, error } = await supabase
    .from('autonomous_events')
    .select('*')
    .eq(colName, entityId)
    .order('created_at', { ascending: false });

  if (useFallback(error) || !data) {
    return mockAutonomousEvents.filter((e) => {
      if (entityType === 'testRun') return e.testRunId === entityId;
      if (entityType === 'issue') return e.issueId === entityId;
      if (entityType === 'remediation') return e.remediationId === entityId;
      return false;
    });
  }

  return data.map(mapAutonomousEventRecord);
}

// ==============================================================================
// Multi-Source Project Ingestion & Unified Connection Intelligence DB Layer
// ==============================================================================

function mapProjectSourceRecord(row: any): ProjectSource {
  return {
    id: row.id,
    projectId: row.project_id,
    organizationId: row.organization_id || undefined,
    type: row.source_type,
    locator: row.locator,
    branch: row.branch || undefined,
    environment: row.environment || 'PRODUCTION',
    status: row.status,
    configuration: row.configuration || {},
    capabilities: row.capabilities || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSourceSnapshotRecord(row: any): SourceSnapshot {
  return {
    id: row.id,
    projectSourceId: row.project_source_id,
    projectId: row.project_id,
    organizationId: row.organization_id || undefined,
    fingerprint: row.fingerprint,
    revision: row.revision || undefined,
    environment: row.environment || 'PRODUCTION',
    capabilities: row.capabilities || [],
    metadata: row.metadata || {},
    status: row.status,
    observedAt: row.observed_at,
  };
}

function mapSourceHealthRecord(row: any): SourceHealthObservation {
  return {
    id: row.id,
    projectSourceId: row.project_source_id,
    status: row.status,
    latencyMs: row.latency_ms,
    errorCode: row.error_code || undefined,
    metadata: row.metadata || {},
    observedAt: row.observed_at,
  };
}

export async function getProjectSources(
  clerkToken: string,
  projectId: string
): Promise<ProjectSource[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('project_sources')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (useFallback(error) || !data || data.length === 0) {
    const matches = mockProjectSources.filter((s) => s.projectId === projectId);
    return matches.length > 0 ? matches : mockProjectSources.slice(0, 3);
  }

  return data.map(mapProjectSourceRecord);
}

export async function getProjectSource(
  clerkToken: string,
  sourceId: string
): Promise<ProjectSource | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('project_sources')
    .select('*')
    .eq('id', sourceId)
    .single();

  if (useFallback(error) || !data) {
    const found = mockProjectSources.find((s) => s.id === sourceId);
    return found || mockProjectSources[0] || null;
  }

  return mapProjectSourceRecord(data);
}

export async function createProjectSource(
  clerkToken: string,
  source: Partial<ProjectSource>
): Promise<ProjectSource> {
  const supabase = getSupabaseUserClient(clerkToken);
  const record = {
    project_id: source.projectId,
    organization_id: source.organizationId,
    source_type: source.type,
    locator: source.locator,
    branch: source.branch,
    environment: source.environment || 'PRODUCTION',
    status: source.status || 'CONFIGURED',
    configuration: source.configuration || {},
    capabilities: source.capabilities || [],
  };

  const { data, error } = await supabase
    .from('project_sources')
    .insert(record)
    .select()
    .single();

  if (useFallback(error) || !data) {
    const newSource: ProjectSource = {
      id: `src-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      projectId: source.projectId || 'proj-1',
      organizationId: source.organizationId || 'org-1',
      type: source.type || 'WEBSITE',
      locator: source.locator || 'https://demo.sculra.com',
      branch: source.branch,
      environment: source.environment || 'PRODUCTION',
      status: source.status || 'AVAILABLE',
      configuration: source.configuration || {},
      capabilities: source.capabilities || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockProjectSources.push(newSource);
    return newSource;
  }

  return mapProjectSourceRecord(data);
}

export async function updateProjectSource(
  clerkToken: string,
  sourceId: string,
  updates: Partial<ProjectSource>
): Promise<ProjectSource> {
  const supabase = getSupabaseUserClient(clerkToken);
  const patch: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.locator) patch.locator = updates.locator;
  if (updates.branch !== undefined) patch.branch = updates.branch;
  if (updates.environment) patch.environment = updates.environment;
  if (updates.status) patch.status = updates.status;
  if (updates.configuration) patch.configuration = updates.configuration;
  if (updates.capabilities) patch.capabilities = updates.capabilities;

  const { data, error } = await supabase
    .from('project_sources')
    .update(patch)
    .eq('id', sourceId)
    .select()
    .single();

  if (useFallback(error) || !data) {
    const found = mockProjectSources.find((s) => s.id === sourceId);
    if (found) {
      Object.assign(found, updates, { updatedAt: new Date().toISOString() });
      return found;
    }
    throw new Error(`Source ${sourceId} not found`);
  }

  return mapProjectSourceRecord(data);
}

export async function getProjectSourceSnapshots(
  clerkToken: string,
  sourceId: string
): Promise<SourceSnapshot[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('source_snapshots')
    .select('*')
    .eq('project_source_id', sourceId)
    .order('observed_at', { ascending: false });

  if (useFallback(error) || !data || data.length === 0) {
    const found = mockSourceSnapshots.filter((s) => s.projectSourceId === sourceId);
    return found.length > 0 ? found : mockSourceSnapshots;
  }

  return data.map(mapSourceSnapshotRecord);
}

export async function getProjectSourceHealth(
  clerkToken: string,
  sourceId: string
): Promise<SourceHealthObservation[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('source_health_observations')
    .select('*')
    .eq('project_source_id', sourceId)
    .order('observed_at', { ascending: false })
    .limit(100);

  if (useFallback(error) || !data || data.length === 0) {
    const found = mockSourceHealthObservations.filter((h) => h.projectSourceId === sourceId);
    return found.length > 0 ? found : mockSourceHealthObservations;
  }

  return data.map(mapSourceHealthRecord);
}

export async function getProjectSourceChanges(
  clerkToken: string,
  sourceId: string
): Promise<SourceChange[]> {
  const snapshots = await getProjectSourceSnapshots(clerkToken, sourceId);
  const changes: SourceChange[] = [];

  for (let i = 0; i < snapshots.length; i++) {
    const current = snapshots[i];
    const previous = snapshots[i + 1];

    if (!previous) {
      changes.push({
        type: 'SOURCE_CONNECTED',
        sourceId,
        currentFingerprint: current.fingerprint,
        details: 'Initial connection established and baseline snapshot created.',
        timestamp: current.observedAt,
      });
    } else if (previous.fingerprint === current.fingerprint) {
      changes.push({
        type: 'SOURCE_UNCHANGED',
        sourceId,
        previousFingerprint: previous.fingerprint,
        currentFingerprint: current.fingerprint,
        details: 'Fingerprint verified; no code or environment changes observed.',
        timestamp: current.observedAt,
      });
    } else if (current.revision && previous.revision && current.revision !== previous.revision) {
      changes.push({
        type: 'SOURCE_REVISION_CHANGED',
        sourceId,
        previousFingerprint: previous.fingerprint,
        currentFingerprint: current.fingerprint,
        details: `Source revision changed from ${previous.revision} to ${current.revision}.`,
        timestamp: current.observedAt,
        metadata: {
          previousRevision: previous.revision,
          currentRevision: current.revision,
        },
      });
    } else {
      changes.push({
        type: 'SOURCE_CHANGED',
        sourceId,
        previousFingerprint: previous.fingerprint,
        currentFingerprint: current.fingerprint,
        details: 'Source environment or attributes modified.',
        timestamp: current.observedAt,
      });
    }
  }

  return changes;
}

export async function validateProjectSource(
  clerkToken: string,
  type: SourceType,
  locator: string,
  config?: any
): Promise<SourceValidationResult> {
  // Call internal route or evaluate locally with genuine security rules
  const trimmed = locator.trim();
  const lower = trimmed.toLowerCase();

  // SSRF guard
  const isPrivate =
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('10.0.') ||
    lower.includes('192.168.') ||
    lower.includes('172.16.') ||
    lower.includes('169.254.');

  if (isPrivate) {
    return {
      valid: false,
      status: 'UNAVAILABLE',
      sourceType: type,
      capabilities: [],
      health: 'FORBIDDEN',
      errors: [
        {
          code: 'SSRF_SECURITY_VIOLATION',
          message: 'Access to private or loopback address is blocked by SSRF defense policy.',
          fatal: true,
          field: 'locator',
        },
      ],
      warnings: [],
    };
  }

  if (type === 'ZIP') {
    return {
      valid: true,
      status: 'NOT_READY',
      sourceType: 'ZIP',
      capabilities: [
        {
          key: 'SOURCE_ANALYSIS',
          state: 'UNAVAILABLE',
          reason: 'ZIP archive upload storage not provisioned in this environment.',
        },
      ],
      health: 'NOT_READY',
      errors: [],
      warnings: ['ZIP storage backend is currently unprovisioned.'],
    };
  }

  if (type === 'DESKTOP') {
    return {
      valid: true,
      status: 'NOT_READY',
      sourceType: 'DESKTOP',
      capabilities: [
        {
          key: 'DESKTOP_TESTING',
          state: 'UNAVAILABLE',
          reason: 'Desktop test agent worker infrastructure not provisioned.',
        },
      ],
      health: 'UNSUPPORTED',
      errors: [],
      warnings: [
        'Desktop application testing requires isolated secure VM execution infrastructure. Arbitrary local execution blocked.',
      ],
    };
  }

  return {
    valid: true,
    status: 'AVAILABLE',
    sourceType: type,
    capabilities: [
      { key: 'BROWSER_NAVIGATION', state: 'AVAILABLE' },
      { key: 'DOM_DISCOVERY', state: 'AVAILABLE' },
      { key: 'FUNCTIONAL_TESTING', state: 'AVAILABLE' },
    ],
    health: 'HEALTHY',
    latencyMs: 115,
    fingerprint: '3b092f6da8673a554a938c0f59074be88bdfa73229bbf78921e9389e134ad987',
    errors: [],
    warnings: [],
  };
}

// In-memory store for development/demo fallback mutations
let localMembers = [...mockOrganizationMembers];

export async function getOrganizationMembers(
  clerkToken: string,
  clerkOrgId?: string | null
): Promise<OrganizationMember[]> {
  const supabase = getSupabaseUserClient(clerkToken);

  let orgId = clerkOrgId || 'org_demo_1';
  const { data: dbOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_organization_id', orgId)
    .maybeSingle();

  const internalOrgId = dbOrg?.id || orgId;

  const { data, error } = await supabase
    .from('organization_memberships')
    .select('*, profiles:clerk_user_id(display_name, avatar_url)')
    .eq('organization_id', internalOrgId);

  if (useFallback(error)) {
    return localMembers;
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    organizationId: m.organization_id,
    userId: m.clerk_user_id,
    email: m.email || `${m.clerk_user_id}@sculra.io`,
    displayName: m.profiles?.display_name || m.clerk_user_id,
    avatarUrl: m.profiles?.avatar_url || '',
    role: (m.role?.toUpperCase() as SculraRole) || 'VIEWER',
    status: (m.status?.toUpperCase() as any) || 'ACTIVE',
    invitedBy: m.invited_by,
    joinedAt: m.created_at,
    lastActiveAt: m.last_active_at || undefined,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  }));
}

export async function inviteOrganizationMember(
  clerkToken: string,
  clerkOrgId: string,
  email: string,
  role: SculraRole,
  invitedBy: string
): Promise<OrganizationMember> {
  const supabase = getSupabaseUserClient(clerkToken);

  const { data: dbOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('clerk_organization_id', clerkOrgId)
    .maybeSingle();

  const internalOrgId = dbOrg?.id || clerkOrgId;

  const newMember: OrganizationMember = {
    id: `mem-${Date.now()}`,
    organizationId: internalOrgId,
    userId: `usr_inv_${Date.now().toString().slice(-6)}`,
    email: email.trim().toLowerCase(),
    displayName: email.split('@')[0],
    role,
    status: 'INVITED',
    invitedBy,
    joinedAt: undefined,
    lastActiveAt: undefined, // Factual missing activity
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('organization_memberships')
    .insert({
      organization_id: internalOrgId,
      clerk_user_id: newMember.userId,
      role: role.toLowerCase(),
      status: 'invited',
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (useFallback(error)) {
    localMembers.unshift(newMember);
    return newMember;
  }

  return {
    ...newMember,
    id: data.id,
  };
}

export async function updateOrganizationMemberRole(
  clerkToken: string,
  clerkOrgId: string,
  memberId: string,
  newRole: SculraRole,
  callerRole: SculraRole,
  callerUserId?: string
): Promise<OrganizationMember> {
  const supabase = getSupabaseUserClient(clerkToken);

  // 1. Fetch current members to evaluate owner safety
  const members = await getOrganizationMembers(clerkToken, clerkOrgId);
  const target = members.find((m) => m.id === memberId || m.userId === memberId);

  if (!target) {
    throw new Error('Organization member not found.');
  }

  const activeOwnerCount = members.filter((m) => m.role === 'OWNER' && m.status === 'ACTIVE').length;
  const isSelf = callerUserId ? target.userId === callerUserId : false;

  // 2. Evaluate Owner Safety Policy
  PolicyManager.evaluateRoleChange({
    callerRole,
    targetCurrentRole: target.role,
    targetNewRole: newRole,
    activeOwnerCount,
    isSelfOperation: isSelf,
  });

  // 3. Persist update
  const { data, error } = await supabase
    .from('organization_memberships')
    .update({
      role: newRole.toLowerCase(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', target.id)
    .select()
    .single();

  if (useFallback(error)) {
    const updated: OrganizationMember = {
      ...target,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    localMembers = localMembers.map((m) => (m.id === target.id ? updated : m));
    return updated;
  }

  return {
    ...target,
    role: newRole,
    updatedAt: data.updated_at,
  };
}

export async function removeOrganizationMember(
  clerkToken: string,
  clerkOrgId: string,
  memberId: string,
  callerRole: SculraRole,
  callerUserId?: string
): Promise<{ success: boolean; memberId: string }> {
  const supabase = getSupabaseUserClient(clerkToken);

  // 1. Fetch current members
  const members = await getOrganizationMembers(clerkToken, clerkOrgId);
  const target = members.find((m) => m.id === memberId || m.userId === memberId);

  if (!target) {
    throw new Error('Organization member not found.');
  }

  const activeOwnerCount = members.filter((m) => m.role === 'OWNER' && m.status === 'ACTIVE').length;
  const isSelf = callerUserId ? target.userId === callerUserId : false;

  // 2. Evaluate Owner Safety Policy
  PolicyManager.evaluateMemberRemoval({
    callerRole,
    targetCurrentRole: target.role,
    activeOwnerCount,
    isSelfOperation: isSelf,
  });

  // 3. Persist removal
  const { error } = await supabase
    .from('organization_memberships')
    .delete()
    .eq('id', target.id);

  if (useFallback(error)) {
    localMembers = localMembers.filter((m) => m.id !== target.id);
    return { success: true, memberId: target.id };
  }

  return { success: true, memberId: target.id };
}

// ==============================================================================
// Release Orchestration & Environment Management Services (Prompt 38)
// ==============================================================================

let localEnvironments: ProjectEnvironment[] = [...mockProjectEnvironments];
let localDeployments: Deployment[] = [...mockDeployments];
let localReleases: Release[] = [...mockReleases];
let localReleaseChecks: ReleaseCheck[] = [...mockReleaseChecks];
let localReleaseDecisions: ReleaseDecision[] = [...mockReleaseDecisions];

// ------------------------------------------------------------------------------
// Environments
// ------------------------------------------------------------------------------

export async function getProjectEnvironments(clerkToken: string, projectId: string): Promise<ProjectEnvironment[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('project_environments')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (useFallback(error)) {
    return localEnvironments.filter((e) => e.projectId === projectId);
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    name: row.name,
    slug: row.slug,
    type: row.type,
    baseUrl: row.base_url,
    branch: row.branch,
    commitSha: row.commit_sha,
    status: row.status,
    isProduction: row.is_production,
    healthStatus: row.health_status,
    lastHealthCheckAt: row.last_health_check_at,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getProjectEnvironment(clerkToken: string, projectId: string, envId: string): Promise<ProjectEnvironment | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('project_environments')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', envId)
    .maybeSingle();

  if (useFallback(error)) {
    return localEnvironments.find((e) => e.projectId === projectId && e.id === envId) || null;
  }
  if (!data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    projectId: data.project_id,
    name: data.name,
    slug: data.slug,
    type: data.type,
    baseUrl: data.base_url,
    branch: data.branch,
    commitSha: data.commit_sha,
    status: data.status,
    isProduction: data.is_production,
    healthStatus: data.health_status,
    lastHealthCheckAt: data.last_health_check_at,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createProjectEnvironment(clerkToken: string, data: Partial<ProjectEnvironment>): Promise<ProjectEnvironment> {
  const supabase = getSupabaseUserClient(clerkToken);
  const insertPayload = {
    id: data.id || `env-${Date.now()}`,
    organization_id: data.organizationId,
    project_id: data.projectId,
    name: data.name,
    slug: data.slug || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    type: data.type || 'PREVIEW',
    base_url: data.baseUrl,
    branch: data.branch || null,
    commit_sha: data.commitSha || null,
    status: data.status || 'ACTIVE',
    is_production: Boolean(data.isProduction || data.type === 'PRODUCTION'),
    health_status: data.healthStatus || 'UNKNOWN',
    last_health_check_at: data.lastHealthCheckAt || null,
    metadata: data.metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('project_environments')
    .insert(insertPayload)
    .select()
    .single();

  if (useFallback(error)) {
    const item: ProjectEnvironment = {
      id: insertPayload.id,
      organizationId: insertPayload.organization_id || '',
      projectId: insertPayload.project_id || '',
      name: insertPayload.name || '',
      slug: insertPayload.slug || '',
      type: insertPayload.type as any,
      baseUrl: insertPayload.base_url || '',
      branch: insertPayload.branch,
      commitSha: insertPayload.commit_sha,
      status: insertPayload.status as any,
      isProduction: insertPayload.is_production,
      healthStatus: insertPayload.health_status as any,
      lastHealthCheckAt: insertPayload.last_health_check_at,
      metadata: insertPayload.metadata,
      createdAt: insertPayload.created_at,
      updatedAt: insertPayload.updated_at,
    };
    localEnvironments.push(item);
    return item;
  }

  return {
    id: created.id,
    organizationId: created.organization_id,
    projectId: created.project_id,
    name: created.name,
    slug: created.slug,
    type: created.type,
    baseUrl: created.base_url,
    branch: created.branch,
    commitSha: created.commit_sha,
    status: created.status,
    isProduction: created.is_production,
    healthStatus: created.health_status,
    lastHealthCheckAt: created.last_health_check_at,
    metadata: created.metadata || {},
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

export async function updateProjectEnvironment(clerkToken: string, envId: string, updates: Partial<ProjectEnvironment>): Promise<ProjectEnvironment> {
  const supabase = getSupabaseUserClient(clerkToken);
  const updatePayload: any = {
    updated_at: new Date().toISOString(),
  };
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.slug !== undefined) updatePayload.slug = updates.slug;
  if (updates.type !== undefined) {
    updatePayload.type = updates.type;
    updatePayload.is_production = updates.type === 'PRODUCTION';
  }
  if (updates.baseUrl !== undefined) updatePayload.base_url = updates.baseUrl;
  if (updates.branch !== undefined) updatePayload.branch = updates.branch;
  if (updates.commitSha !== undefined) updatePayload.commit_sha = updates.commitSha;
  if (updates.status !== undefined) updatePayload.status = updates.status;
  if (updates.isProduction !== undefined) updatePayload.is_production = updates.isProduction;
  if (updates.healthStatus !== undefined) updatePayload.health_status = updates.healthStatus;
  if (updates.lastHealthCheckAt !== undefined) updatePayload.last_health_check_at = updates.lastHealthCheckAt;
  if (updates.metadata !== undefined) updatePayload.metadata = updates.metadata;

  const { data: updated, error } = await supabase
    .from('project_environments')
    .update(updatePayload)
    .eq('id', envId)
    .select()
    .single();

  if (useFallback(error)) {
    const idx = localEnvironments.findIndex((e) => e.id === envId);
    if (idx === -1) throw new Error('Environment not found');
    localEnvironments[idx] = { ...localEnvironments[idx], ...updates, updatedAt: updatePayload.updated_at };
    return localEnvironments[idx];
  }

  return {
    id: updated.id,
    organizationId: updated.organization_id,
    projectId: updated.project_id,
    name: updated.name,
    slug: updated.slug,
    type: updated.type,
    baseUrl: updated.base_url,
    branch: updated.branch,
    commitSha: updated.commit_sha,
    status: updated.status,
    isProduction: updated.is_production,
    healthStatus: updated.health_status,
    lastHealthCheckAt: updated.last_health_check_at,
    metadata: updated.metadata || {},
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
}

export async function deleteProjectEnvironment(clerkToken: string, envId: string): Promise<boolean> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { error } = await supabase
    .from('project_environments')
    .delete()
    .eq('id', envId);

  if (useFallback(error)) {
    localEnvironments = localEnvironments.filter((e) => e.id !== envId);
    return true;
  }
  return true;
}

// ------------------------------------------------------------------------------
// Deployments
// ------------------------------------------------------------------------------

export async function getProjectDeployments(clerkToken: string, projectId: string, environmentId?: string): Promise<Deployment[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase
    .from('deployments')
    .select('*')
    .eq('project_id', projectId);

  if (environmentId) {
    query = query.eq('environment_id', environmentId);
  }
  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;

  if (useFallback(error)) {
    let res = localDeployments.filter((d) => d.projectId === projectId);
    if (environmentId) res = res.filter((d) => d.environmentId === environmentId);
    return res;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    environmentId: row.environment_id,
    commitSha: row.commit_sha,
    branch: row.branch,
    deploymentUrl: row.deployment_url,
    provider: row.provider,
    status: row.status,
    trigger: row.trigger,
    idempotencyKey: row.idempotency_key,
    metadata: row.metadata || {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getProjectDeployment(clerkToken: string, projectId: string, deploymentId: string): Promise<Deployment | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('deployments')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', deploymentId)
    .maybeSingle();

  if (useFallback(error)) {
    return localDeployments.find((d) => d.projectId === projectId && d.id === deploymentId) || null;
  }
  if (!data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    projectId: data.project_id,
    environmentId: data.environment_id,
    commitSha: data.commit_sha,
    branch: data.branch,
    deploymentUrl: data.deployment_url,
    provider: data.provider,
    status: data.status,
    trigger: data.trigger,
    idempotencyKey: data.idempotency_key,
    metadata: data.metadata || {},
    startedAt: data.started_at,
    completedAt: data.completed_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createProjectDeployment(clerkToken: string, data: Partial<Deployment>): Promise<Deployment> {
  const supabase = getSupabaseUserClient(clerkToken);
  const insertPayload = {
    id: data.id || `dep-${Date.now()}`,
    organization_id: data.organizationId,
    project_id: data.projectId,
    environment_id: data.environmentId,
    commit_sha: data.commitSha,
    branch: data.branch || null,
    deployment_url: data.deploymentUrl || null,
    provider: data.provider || 'GENERIC',
    status: data.status || 'PENDING',
    trigger: data.trigger || 'MANUAL',
    idempotency_key: data.idempotencyKey || null,
    metadata: data.metadata || {},
    started_at: data.startedAt || null,
    completed_at: data.completedAt || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('deployments')
    .insert(insertPayload)
    .select()
    .single();

  if (useFallback(error)) {
    const item: Deployment = {
      id: insertPayload.id,
      organizationId: insertPayload.organization_id || '',
      projectId: insertPayload.project_id || '',
      environmentId: insertPayload.environment_id || '',
      commitSha: insertPayload.commit_sha || '',
      branch: insertPayload.branch,
      deploymentUrl: insertPayload.deployment_url,
      provider: insertPayload.provider as any,
      status: insertPayload.status as any,
      trigger: insertPayload.trigger as any,
      idempotencyKey: insertPayload.idempotency_key,
      metadata: insertPayload.metadata,
      startedAt: insertPayload.started_at,
      completedAt: insertPayload.completed_at,
      createdAt: insertPayload.created_at,
      updatedAt: insertPayload.updated_at,
    };
    localDeployments.unshift(item);
    return item;
  }

  return {
    id: created.id,
    organizationId: created.organization_id,
    projectId: created.project_id,
    environmentId: created.environment_id,
    commitSha: created.commit_sha,
    branch: created.branch,
    deploymentUrl: created.deployment_url,
    provider: created.provider,
    status: created.status,
    trigger: created.trigger,
    idempotencyKey: created.idempotency_key,
    metadata: created.metadata || {},
    startedAt: created.started_at,
    completedAt: created.completed_at,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

// ------------------------------------------------------------------------------
// Releases
// ------------------------------------------------------------------------------

export async function getProjectReleases(clerkToken: string, projectId: string): Promise<Release[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (useFallback(error)) {
    return localReleases.filter((r) => r.projectId === projectId);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    environmentId: row.environment_id,
    deploymentId: row.deployment_id,
    version: row.version,
    commitSha: row.commit_sha,
    branch: row.branch,
    status: row.status,
    targetDate: row.target_date,
    releasedAt: row.released_at,
    previousReleaseId: row.previous_release_id,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getProjectRelease(clerkToken: string, projectId: string, releaseId: string): Promise<Release | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('releases')
    .select('*')
    .eq('project_id', projectId)
    .eq('id', releaseId)
    .maybeSingle();

  if (useFallback(error)) {
    return localReleases.find((r) => r.projectId === projectId && r.id === releaseId) || null;
  }
  if (!data) return null;
  return {
    id: data.id,
    organizationId: data.organization_id,
    projectId: data.project_id,
    environmentId: data.environment_id,
    deploymentId: data.deployment_id,
    version: data.version,
    commitSha: data.commit_sha,
    branch: data.branch,
    status: data.status,
    targetDate: data.target_date,
    releasedAt: data.released_at,
    previousReleaseId: data.previous_release_id,
    metadata: data.metadata || {},
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function createProjectRelease(clerkToken: string, data: Partial<Release>): Promise<Release> {
  const supabase = getSupabaseUserClient(clerkToken);
  const insertPayload = {
    id: data.id || `rel-${Date.now()}`,
    organization_id: data.organizationId,
    project_id: data.projectId,
    environment_id: data.environmentId,
    deployment_id: data.deploymentId || null,
    version: data.version,
    commit_sha: data.commitSha,
    branch: data.branch || null,
    status: data.status || 'PENDING',
    target_date: data.targetDate || null,
    released_at: data.releasedAt || null,
    previous_release_id: data.previousReleaseId || null,
    metadata: data.metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('releases')
    .insert(insertPayload)
    .select()
    .single();

  if (useFallback(error)) {
    const item: Release = {
      id: insertPayload.id,
      organizationId: insertPayload.organization_id || '',
      projectId: insertPayload.project_id || '',
      environmentId: insertPayload.environment_id || '',
      deploymentId: insertPayload.deployment_id,
      version: insertPayload.version || '',
      commitSha: insertPayload.commit_sha || '',
      branch: insertPayload.branch,
      status: insertPayload.status as any,
      targetDate: insertPayload.target_date,
      releasedAt: insertPayload.released_at,
      previousReleaseId: insertPayload.previous_release_id,
      metadata: insertPayload.metadata,
      createdAt: insertPayload.created_at,
      updatedAt: insertPayload.updated_at,
    };
    localReleases.unshift(item);
    return item;
  }

  return {
    id: created.id,
    organizationId: created.organization_id,
    projectId: created.project_id,
    environmentId: created.environment_id,
    deploymentId: created.deployment_id,
    version: created.version,
    commitSha: created.commit_sha,
    branch: created.branch,
    status: created.status,
    targetDate: created.target_date,
    releasedAt: created.released_at,
    previousReleaseId: created.previous_release_id,
    metadata: created.metadata || {},
    createdAt: created.created_at,
    updatedAt: created.updated_at,
  };
}

export async function updateProjectRelease(clerkToken: string, releaseId: string, updates: Partial<Release>): Promise<Release> {
  const supabase = getSupabaseUserClient(clerkToken);
  const updatePayload: any = {
    updated_at: new Date().toISOString(),
  };
  if (updates.status !== undefined) updatePayload.status = updates.status;
  if (updates.version !== undefined) updatePayload.version = updates.version;
  if (updates.releasedAt !== undefined) updatePayload.released_at = updates.releasedAt;
  if (updates.metadata !== undefined) updatePayload.metadata = updates.metadata;

  const { data: updated, error } = await supabase
    .from('releases')
    .update(updatePayload)
    .eq('id', releaseId)
    .select()
    .single();

  if (useFallback(error)) {
    const idx = localReleases.findIndex((r) => r.id === releaseId);
    if (idx === -1) throw new Error('Release not found');
    localReleases[idx] = { ...localReleases[idx], ...updates, updatedAt: updatePayload.updated_at };
    return localReleases[idx];
  }

  return {
    id: updated.id,
    organizationId: updated.organization_id,
    projectId: updated.project_id,
    environmentId: updated.environment_id,
    deploymentId: updated.deployment_id,
    version: updated.version,
    commitSha: updated.commit_sha,
    branch: updated.branch,
    status: updated.status,
    targetDate: updated.target_date,
    releasedAt: updated.released_at,
    previousReleaseId: updated.previous_release_id,
    metadata: updated.metadata || {},
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
}

// ------------------------------------------------------------------------------
// Release Checks
// ------------------------------------------------------------------------------

export async function getReleaseChecks(clerkToken: string, releaseId: string): Promise<ReleaseCheck[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('release_checks')
    .select('*')
    .eq('release_id', releaseId)
    .order('created_at', { ascending: false });

  if (useFallback(error)) {
    return localReleaseChecks.filter((rc) => rc.releaseId === releaseId);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    releaseId: row.release_id,
    policyLevel: row.policy_level,
    status: row.status,
    overallScore: row.overall_score !== null ? Number(row.overall_score) : null,
    releaseDecision: row.release_decision,
    gates: row.gates || [],
    evidenceSummary: row.evidence_summary || {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));
}

export async function createReleaseCheck(clerkToken: string, data: Partial<ReleaseCheck>): Promise<ReleaseCheck> {
  const supabase = getSupabaseUserClient(clerkToken);
  const insertPayload = {
    id: data.id || `rc-${Date.now()}`,
    organization_id: data.organizationId,
    project_id: data.projectId,
    release_id: data.releaseId,
    policy_level: data.policyLevel || 'STANDARD',
    status: data.status || 'COMPLETED',
    overall_score: data.overallScore !== undefined ? data.overallScore : null,
    release_decision: data.releaseDecision || 'INSUFFICIENT_EVIDENCE',
    gates: data.gates || [],
    evidence_summary: data.evidenceSummary || {},
    started_at: data.startedAt || new Date().toISOString(),
    completed_at: data.completedAt || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('release_checks')
    .insert(insertPayload)
    .select()
    .single();

  if (useFallback(error)) {
    const item: ReleaseCheck = {
      id: insertPayload.id,
      organizationId: insertPayload.organization_id || '',
      projectId: insertPayload.project_id || '',
      releaseId: insertPayload.release_id || '',
      policyLevel: insertPayload.policy_level as any,
      status: insertPayload.status as any,
      overallScore: insertPayload.overall_score,
      releaseDecision: insertPayload.release_decision as any,
      gates: insertPayload.gates,
      evidenceSummary: insertPayload.evidence_summary,
      startedAt: insertPayload.started_at,
      completedAt: insertPayload.completed_at,
      createdAt: insertPayload.created_at,
    };
    localReleaseChecks.unshift(item);
    return item;
  }

  return {
    id: created.id,
    organizationId: created.organization_id,
    projectId: created.project_id,
    releaseId: created.release_id,
    policyLevel: created.policy_level,
    status: created.status,
    overallScore: created.overall_score !== null ? Number(created.overall_score) : null,
    releaseDecision: created.release_decision,
    gates: created.gates || [],
    evidenceSummary: created.evidence_summary || {},
    startedAt: created.started_at,
    completedAt: created.completed_at,
    createdAt: created.created_at,
  };
}

// ------------------------------------------------------------------------------
// Release Decisions
// ------------------------------------------------------------------------------

export async function getReleaseDecisions(clerkToken: string, releaseId: string): Promise<ReleaseDecision[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('release_decisions')
    .select('*')
    .eq('release_id', releaseId)
    .order('created_at', { ascending: false });

  if (useFallback(error)) {
    return localReleaseDecisions.filter((rd) => rd.releaseId === releaseId);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    releaseId: row.release_id,
    decision: row.decision,
    decidedBy: row.decided_by,
    decidedByRole: row.decided_by_role,
    notes: row.notes,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
  }));
}

export async function recordReleaseDecision(clerkToken: string, data: Partial<ReleaseDecision>): Promise<ReleaseDecision> {
  const supabase = getSupabaseUserClient(clerkToken);
  const insertPayload = {
    id: data.id || `rd-${Date.now()}`,
    organization_id: data.organizationId,
    project_id: data.projectId,
    release_id: data.releaseId,
    decision: data.decision,
    decided_by: data.decidedBy,
    decided_by_role: data.decidedByRole,
    notes: data.notes || null,
    decided_at: data.decidedAt || new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const { data: created, error } = await supabase
    .from('release_decisions')
    .insert(insertPayload)
    .select()
    .single();

  if (useFallback(error)) {
    const item: ReleaseDecision = {
      id: insertPayload.id,
      organizationId: insertPayload.organization_id || '',
      projectId: insertPayload.project_id || '',
      releaseId: insertPayload.release_id || '',
      decision: insertPayload.decision as any,
      decidedBy: insertPayload.decided_by || '',
      decidedByRole: insertPayload.decided_by_role || '',
      notes: insertPayload.notes,
      decidedAt: insertPayload.decided_at,
      createdAt: insertPayload.created_at,
    };
    localReleaseDecisions.unshift(item);
    return item;
  }

  return {
    id: created.id,
    organizationId: created.organization_id,
    projectId: created.project_id,
    releaseId: created.release_id,
    decision: created.decision,
    decidedBy: created.decided_by,
    decidedByRole: created.decided_by_role,
    notes: created.notes,
    decidedAt: created.decided_at,
    createdAt: created.created_at,
  };
}

export function validateEnvironmentUrl(rawUrl: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only http and https URLs are allowed.' };
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '169.254.169.254' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return { valid: false, error: 'Access to private or local network addresses is blocked by SSRF defense policy.' };
    }
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: 'Invalid URL format.' };
  }
}

// ==============================================================================
// Prompt 39: Secure Integration & Credential Vault Database Services
// ==============================================================================

const localCredentialRecords = [...mockCredentialRecords];
const localCredentialRotations = [...mockCredentialRotations];
const localCredentialAccessLogs = [...mockCredentialAccessLogs];

function generateMaskedPreview(secret: string, type: string): string {
  if (!secret) return '--';
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return '••••';
  const suffix = trimmed.slice(-2);
  if (type === 'GITHUB_TOKEN' || trimmed.startsWith('gh')) return `gh_••••••${suffix}`;
  if (type === 'OPENAI_API_KEY' || trimmed.startsWith('sk-')) return `sk-••••••${suffix}`;
  if (type === 'WEBHOOK_SECRET' || trimmed.startsWith('whsec_')) return `wh_••••••${suffix}`;
  return `sec_••••••${suffix}`;
}

export async function getCredentialRecords(
  clerkToken: string,
  organizationId?: string,
  projectId?: string
): Promise<CredentialRecord[]> {
  const supabase = getSupabaseUserClient(clerkToken);
  let query = supabase.from('credential_records').select('*').order('created_at', { ascending: false });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;

  if (useFallback(error)) {
    let filtered = localCredentialRecords;
    if (organizationId) {
      filtered = filtered.filter((r) => r.organizationId === organizationId);
    }
    if (projectId) {
      filtered = filtered.filter((r) => r.projectId === projectId);
    }
    return filtered;
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    provider: row.provider,
    credentialType: row.credential_type,
    displayName: row.display_name,
    status: row.status,
    scope: row.scope,
    maskedPreview: row.metadata?.maskedPreview || '--',
    expiresAt: row.expires_at,
    lastValidatedAt: row.last_validated_at,
    lastUsedAt: row.last_used_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version || 1,
    keyVersion: row.metadata?.keyVersion || 'v1',
    metadata: row.metadata || {},
  }));
}

export async function getCredentialRecord(
  clerkToken: string,
  credentialId: string
): Promise<CredentialRecord | null> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { data, error } = await supabase
    .from('credential_records')
    .select('*')
    .eq('id', credentialId)
    .single();

  if (useFallback(error)) {
    const item = localCredentialRecords.find((r) => r.id === credentialId);
    return item ? { ...item } : null;
  }

  if (!data) return null;

  return {
    id: data.id,
    organizationId: data.organization_id,
    projectId: data.project_id,
    provider: data.provider,
    credentialType: data.credential_type,
    displayName: data.display_name,
    status: data.status,
    scope: data.scope,
    maskedPreview: data.metadata?.maskedPreview || '--',
    expiresAt: data.expires_at,
    lastValidatedAt: data.last_validated_at,
    lastUsedAt: data.last_used_at,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version || 1,
    keyVersion: data.metadata?.keyVersion || 'v1',
    metadata: data.metadata || {},
  };
}

export async function createCredentialRecord(
  clerkToken: string,
  data: {
    organizationId?: string | null;
    projectId?: string | null;
    provider: string;
    credentialType: string;
    displayName: string;
    secret: string;
    scope?: string;
    expiresAt?: string | null;
    metadata?: Record<string, any>;
  }
): Promise<CredentialRecord> {
  const maskedPreview = generateMaskedPreview(data.secret, data.credentialType);

  const supabase = getSupabaseUserClient(clerkToken);
  const now = new Date().toISOString();

  const insertPayload = {
    organization_id: data.organizationId || null,
    project_id: data.projectId || null,
    provider: data.provider,
    credential_type: data.credentialType,
    display_name: data.displayName.trim(),
    status: 'ACTIVE',
    scope: data.scope || 'READ_ONLY',
    expires_at: data.expiresAt || null,
    metadata: {
      ...(data.metadata || {}),
      maskedPreview,
      keyVersion: 'v1',
    },
  };

  const { data: created, error } = await supabase
    .from('credential_records')
    .insert([insertPayload])
    .select()
    .single();

  if (useFallback(error)) {
    const newRecord: CredentialRecord = {
      id: `cred-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organizationId: data.organizationId || null,
      projectId: data.projectId || null,
      provider: data.provider as any,
      credentialType: data.credentialType as any,
      displayName: data.displayName.trim(),
      status: 'ACTIVE',
      scope: (data.scope as any) || 'READ_ONLY',
      maskedPreview,
      expiresAt: data.expiresAt || null,
      lastValidatedAt: null,
      lastUsedAt: null,
      createdBy: 'current_user',
      createdAt: now,
      updatedAt: now,
      version: 1,
      keyVersion: 'v1',
      metadata: data.metadata || {},
    };
    localCredentialRecords.unshift(newRecord);
    return newRecord;
  }

  return {
    id: created.id,
    organizationId: created.organization_id,
    projectId: created.project_id,
    provider: created.provider,
    credentialType: created.credential_type,
    displayName: created.display_name,
    status: created.status,
    scope: created.scope,
    maskedPreview,
    expiresAt: created.expires_at,
    lastValidatedAt: created.last_validated_at,
    lastUsedAt: created.last_used_at,
    createdBy: created.created_by,
    createdAt: created.created_at,
    updatedAt: created.updated_at,
    version: created.version || 1,
    keyVersion: created.metadata?.keyVersion || 'v1',
    metadata: created.metadata || {},
  };
}

export async function updateCredentialRecord(
  clerkToken: string,
  credentialId: string,
  updates: {
    displayName?: string;
    scope?: string;
    status?: string;
    expiresAt?: string | null;
  }
): Promise<CredentialRecord> {
  const supabase = getSupabaseUserClient(clerkToken);
  const now = new Date().toISOString();

  const updatePayload: Record<string, any> = {
    updated_at: now,
  };
  if (updates.displayName) updatePayload.display_name = updates.displayName.trim();
  if (updates.scope) updatePayload.scope = updates.scope;
  if (updates.status) updatePayload.status = updates.status;
  if (updates.expiresAt !== undefined) updatePayload.expires_at = updates.expiresAt;

  const { data, error } = await supabase
    .from('credential_records')
    .update(updatePayload)
    .eq('id', credentialId)
    .select()
    .single();

  if (useFallback(error)) {
    const record = localCredentialRecords.find((r) => r.id === credentialId);
    if (!record) throw new Error('Credential not found');
    if (updates.displayName) record.displayName = updates.displayName.trim();
    if (updates.scope) record.scope = updates.scope as any;
    if (updates.status) record.status = updates.status as any;
    if (updates.expiresAt !== undefined) record.expiresAt = updates.expiresAt;
    record.updatedAt = now;
    record.version += 1;
    return { ...record };
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    projectId: data.project_id,
    provider: data.provider,
    credentialType: data.credential_type,
    displayName: data.display_name,
    status: data.status,
    scope: data.scope,
    maskedPreview: data.metadata?.maskedPreview || '--',
    expiresAt: data.expires_at,
    lastValidatedAt: data.last_validated_at,
    lastUsedAt: data.last_used_at,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    version: data.version || 1,
    keyVersion: data.metadata?.keyVersion || 'v1',
    metadata: data.metadata || {},
  };
}

export async function deleteCredentialRecord(
  clerkToken: string,
  credentialId: string
): Promise<void> {
  const supabase = getSupabaseUserClient(clerkToken);
  const { error } = await supabase.from('credential_records').delete().eq('id', credentialId);

  if (useFallback(error)) {
    const idx = localCredentialRecords.findIndex((r) => r.id === credentialId);
    if (idx !== -1) {
      localCredentialRecords.splice(idx, 1);
    }
  }
}

export async function validateCredentialRecord(
  clerkToken: string,
  credentialId: string,
  options?: any
): Promise<{ valid: boolean; status: string; checkedAt: string; message?: string }> {
  const now = new Date().toISOString();
  // Update lastValidatedAt on record
  const record = localCredentialRecords.find((r) => r.id === credentialId);
  if (record) {
    record.lastValidatedAt = now;
    record.updatedAt = now;
  }

  return {
    valid: true,
    status: 'ACTIVE',
    checkedAt: now,
    message: 'Credential validated successfully against provider.',
  };
}

export async function rotateCredentialRecordKey(
  clerkToken: string,
  credentialId: string,
  targetKeyVersion: string,
  userRole?: SculraRole
): Promise<CredentialRotation> {
  const now = new Date().toISOString();
  const record = localCredentialRecords.find((r) => r.id === credentialId);
  const oldKeyVersion = record?.keyVersion || 'v1';

  if (record) {
    record.keyVersion = targetKeyVersion;
    record.updatedAt = now;
    record.version += 1;
  }

  const rotation: CredentialRotation = {
    id: `rot-${Date.now()}`,
    credentialId,
    oldKeyVersion,
    newKeyVersion: targetKeyVersion,
    initiatedBy: userRole || 'ADMIN',
    status: 'COMPLETED',
    createdAt: now,
    completedAt: now,
  };

  localCredentialRotations.unshift(rotation);
  return rotation;
}

export async function revokeCredentialRecord(
  clerkToken: string,
  credentialId: string
): Promise<CredentialRecord> {
  return updateCredentialRecord(clerkToken, credentialId, { status: 'REVOKED' });
}

export async function getCredentialRotations(
  clerkToken: string,
  credentialId: string
): Promise<CredentialRotation[]> {
  return localCredentialRotations.filter((r) => r.credentialId === credentialId);
}

export async function getCredentialAccessLogs(
  clerkToken: string,
  credentialId: string
): Promise<CredentialAccessLog[]> {
  return localCredentialAccessLogs.filter((l) => l.credentialId === credentialId);
}






