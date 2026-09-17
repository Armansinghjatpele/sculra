'use client';

// ==============================================================================
// Sculra Project CI/CD Gates & Developer Feedback Dashboard
// (frontend/app/(authenticated)/projects/[projectId]/cicd/page.tsx)
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Stack, Flex, Grid } from '@/components/LayoutPrimitives';
import { getVerdictBadgeClass, getVerdictLabel, getPolicyLabel, formatCommitSha, formatTimestamp, getReasonCodeLabel } from '@/lib/cicdUtils';
import { CICDGateResult, CICDWebhookEvent } from '@/lib/demoData';

export default function ProjectCICDPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Config state
  const [ciEnabled, setCiEnabled] = useState(false);
  const [repoOwner, setRepoOwner] = useState('');
  const [repoName, setRepoName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [triggerOnPush, setTriggerOnPush] = useState(true);
  const [triggerOnPr, setTriggerOnPr] = useState(true);
  const [gatePolicy, setGatePolicy] = useState('BLOCK_ON_CRITICAL_ISSUE');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // History state
  const [gateResults, setGateResults] = useState<CICDGateResult[]>([]);
  const [events, setEvents] = useState<CICDWebhookEvent[]>([]);
  const [selectedResult, setSelectedResult] = useState<CICDGateResult | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/webhooks/github`);
    }

    async function loadData() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;

        const res = await fetch(`/api/projects/${projectId}/cicd`);
        if (res.ok) {
          const data = await res.json();
          if (data.config) {
            setCiEnabled(!!data.config.ciEnabled);
            setRepoOwner(data.config.githubRepoOwner || '');
            setRepoName(data.config.githubRepoName || '');
            setDefaultBranch(data.config.ciDefaultBranch || 'main');
            setTriggerOnPush(data.config.ciTriggerOnPush !== false);
            setTriggerOnPr(data.config.ciTriggerOnPr !== false);
            setGatePolicy(data.config.ciGatePolicy || 'BLOCK_ON_CRITICAL_ISSUE');
            setWebhookSecret(data.config.ciWebhookSecret || '');
          }
          if (data.gateResults) setGateResults(data.gateResults);
          if (data.events) setEvents(data.events);
        }
      } catch (err: any) {
        console.error('[CI/CD Page Load Error]:', err);
      } finally {
        setLoading(false);
      }
    }

    if (projectId) {
      loadData();
    }
  }, [projectId, getToken]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/cicd`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciEnabled,
          githubRepoOwner: repoOwner,
          githubRepoName: repoName,
          ciDefaultBranch: defaultBranch,
          ciTriggerOnPush: triggerOnPush,
          ciTriggerOnPr: triggerOnPr,
          ciGatePolicy: gatePolicy,
          ciWebhookSecret: webhookSecret,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSaveSuccess('CI/CD settings saved successfully.');
      } else {
        setSaveError(data.error || 'Failed saving configuration.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Network error updating settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateSecret = async () => {
    if (!confirm('Regenerate webhook secret? You must update your GitHub Webhook configuration.')) {
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/projects/${projectId}/cicd`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateSecret: true }),
      });
      const data = await res.json();
      if (res.ok && data.config?.ci_webhook_secret) {
        setWebhookSecret(data.config.ci_webhook_secret);
        setSaveSuccess('New webhook secret generated.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed generating secret.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string, isSecret = false) => {
    navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  }

  const latestResult = gateResults[0] || null;

  return (
    <Stack spacing={24} className="pb-16">
      <PageHeader
        title="CI/CD QA Gates & Developer Feedback"
        description="Automate QA execution on code pushes and pull requests with deterministic release quality gates."
        action={
          <Flex align="center" className="gap-3">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">Back to Project</Button>
            </Link>
            <Link href={`/projects/${projectId}/campaigns`}>
              <Button variant="accent" size="sm">QA Campaigns</Button>
            </Link>
          </Flex>
        }
      />

      {/* Top Metrics / Status Row */}
      <Grid cols={3} gap={16}>
        <Card className="p-5 border border-border/50 bg-surface/50">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">CI Status</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${ciEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-lg font-bold text-foreground">{ciEnabled ? 'Active' : 'Disabled'}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ciEnabled ? 'Incoming webhooks trigger QA campaigns' : 'Webhooks are ignored until enabled'}
          </p>
        </Card>

        <Card className="p-5 border border-border/50 bg-surface/50">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Gate Policy</div>
          <div className="mt-2 text-base font-bold text-foreground truncate">
            {getPolicyLabel(gatePolicy)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enforced on all automated CI test runs
          </p>
        </Card>

        <Card className="p-5 border border-border/50 bg-surface/50">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Latest Verdict</div>
          <div className="mt-2 flex items-center gap-2">
            {latestResult ? (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getVerdictBadgeClass(latestResult.gateVerdict)}`}>
                {getVerdictLabel(latestResult.gateVerdict)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No runs yet</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {latestResult ? `Commit ${formatCommitSha(latestResult.commitSha)}` : 'Awaiting first webhook'}
          </p>
        </Card>
      </Grid>

      {/* Configuration Section */}
      <Card className="p-6 border border-border/60 bg-surface">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Webhook & CI Configuration
        </h2>

        {saveSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
            {saveSuccess}
          </div>
        )}
        {saveError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6">
          {/* Toggle CI */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border/40">
            <div>
              <div className="font-semibold text-foreground">Enable CI/CD Automated QA</div>
              <div className="text-xs text-muted-foreground">
                When enabled, valid GitHub webhooks will trigger autonomous QA campaigns.
              </div>
            </div>
            <input
              type="checkbox"
              checked={ciEnabled}
              onChange={(e) => setCiEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-border text-accent focus:ring-accent accent-accent"
            />
          </div>

          {/* Webhook URL display */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              GitHub Webhook Payload URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground font-mono focus:outline-none"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(webhookUrl, false)}
                className="whitespace-nowrap"
              >
                {copiedUrl ? 'Copied!' : 'Copy URL'}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Add this URL to your GitHub repository settings under <strong>Webhooks</strong> $\to$ <strong>Add Webhook</strong> with Content type: <code>application/json</code>.
            </p>
          </div>

          {/* Webhook Secret */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
              Webhook Secret (HMAC SHA-256)
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showSecret ? 'text' : 'password'}
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Enter or generate secret"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground font-mono focus:outline-none focus:border-accent"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? 'Hide' : 'Reveal'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleCopy(webhookSecret, true)}
              >
                {copiedSecret ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRegenerateSecret}
                className="text-rose-400 hover:text-rose-300"
              >
                Regenerate
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Used to sign payload with <code>x-hub-signature-256</code>. Verified using constant-time comparison.
            </p>
          </div>

          {/* Repo Coordinates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                GitHub Owner / Org
              </label>
              <input
                type="text"
                value={repoOwner}
                onChange={(e) => setRepoOwner(e.target.value)}
                placeholder="e.g. acme-corp"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                GitHub Repository Name
              </label>
              <input
                type="text"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="e.g. web-app"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                Default Branch
              </label>
              <input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Trigger rules & Gate Policy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3 p-4 rounded-lg bg-background/50 border border-border/40">
              <div className="font-semibold text-foreground text-sm">Automated Triggers</div>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerOnPush}
                  onChange={(e) => setTriggerOnPush(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
                />
                <span>Trigger QA Campaign on Git Push</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerOnPr}
                  onChange={(e) => setTriggerOnPr(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent accent-accent"
                />
                <span>Trigger QA Campaign on Pull Requests (opened, sync, reopened)</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                CI Gate Policy
              </label>
              <select
                value={gatePolicy}
                onChange={(e) => setGatePolicy(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent"
              >
                <option value="BLOCK_ON_CRITICAL_ISSUE">Block on Critical Issues (Default)</option>
                <option value="STRICT">Strict (Zero Regressions, High Score &gt;= 80)</option>
                <option value="PERMISSIVE">Permissive (Allows minor warnings)</option>
                <option value="BLOCK_ON_REGRESSION">Block on Regressions Only</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Determines whether pull request checks pass or fail based on detected findings and release readiness.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="accent" disabled={saving}>
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </Card>

      {/* CI Gate Results History */}
      <Card className="p-6 border border-border/60 bg-surface">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          CI Gate Execution History
        </h2>

        {gateResults.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/50 rounded-lg">
            <p className="text-muted-foreground text-sm">No CI gate evaluations recorded yet.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              Once GitHub webhooks are received, gate decisions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground bg-background/30">
                <tr>
                  <th className="py-3 px-4">Verdict</th>
                  <th className="py-3 px-4">Commit / PR</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Policy</th>
                  <th className="py-3 px-4">Blockers</th>
                  <th className="py-3 px-4">Regressions</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {gateResults.map((res) => (
                  <tr key={res.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getVerdictBadgeClass(res.gateVerdict)}`}>
                        {getVerdictLabel(res.gateVerdict)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-foreground">
                      {res.pullRequestNumber ? `PR #${res.pullRequestNumber}` : formatCommitSha(res.commitSha)}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {res.branch || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {res.gatePolicy}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {res.criticalFindingsCount > 0 ? (
                        <span className="text-rose-400 font-bold">{res.criticalFindingsCount}</span>
                      ) : (
                        <span className="text-emerald-400">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {res.regressionCount > 0 ? (
                        <span className="text-amber-400 font-bold">{res.regressionCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(res.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedResult(res)}
                      >
                        Feedback
                      </Button>
                      {res.campaignId && (
                        <Link href={`/campaigns/${res.campaignId}`}>
                          <Button variant="accent" size="sm">
                            Campaign
                          </Button>
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Webhook Delivery Log */}
      <Card className="p-6 border border-border/60 bg-surface">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Recent Webhook Ingestion Events
        </h2>

        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4">No recent webhook events received.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground bg-background/30">
                <tr>
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">Delivery ID</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Repository</th>
                  <th className="py-2.5 px-4">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-xs text-foreground uppercase">
                      {evt.eventType}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">
                      {evt.deliveryId.slice(0, 12)}...
                    </td>
                    <td className="py-2.5 px-4 text-xs">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        evt.status === 'SCHEDULED' || evt.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : evt.status === 'IGNORED'
                          ? 'bg-slate-500/10 text-slate-400'
                          : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-foreground">
                      {evt.repository}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(evt.receivedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Feedback Modal / Drawer */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-surface border border-border rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  CI Gate Developer Feedback
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verdict: <span className="font-semibold text-foreground">{selectedResult.gateVerdict}</span> | Policy: {selectedResult.gatePolicy}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedResult(null)}>
                Close
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 font-sans text-sm text-foreground">
              {selectedResult.summaryMarkdown ? (
                <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap font-mono bg-background/60 p-4 rounded-lg border border-border/50">
                  {selectedResult.summaryMarkdown}
                </div>
              ) : (
                <p className="text-muted-foreground">No markdown summary available for this run.</p>
              )}

              {selectedResult.reasonCodes && selectedResult.reasonCodes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Gate Decision Reason Codes</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedResult.reasonCodes.map((code) => (
                      <span key={code} className="px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground">
                        {getReasonCodeLabel(code)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-3 bg-background/30">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedResult.summaryMarkdown) {
                    navigator.clipboard.writeText(selectedResult.summaryMarkdown);
                    alert('Markdown feedback copied to clipboard!');
                  }
                }}
              >
                Copy Markdown
              </Button>
              <Button variant="accent" size="sm" onClick={() => setSelectedResult(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </Stack>
  );
}
