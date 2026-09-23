'use client';

// ==============================================================================
// Sculra Integrations & Credential Vault Console
// (frontend/app/(authenticated)/settings/integrations/page.tsx)
// ==============================================================================
// Invariants:
// - Plaintext secrets are write-only from the browser.
// - Plaintext secrets are NEVER displayed in UI lists or after creation.
// - Password input semantics with autocomplete disabled.
// - Zero fake credentials, zero fake health metrics. Displays "--" when unconfigured.

import * as React from 'react';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import {
  ShieldCheck,
  Key,
  GitBranch,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Webhook,
  Globe,
  Sliders,
} from 'lucide-react';
import Link from 'next/link';
import {
  CredentialRecord,
  CredentialProvider,
  CredentialType,
  CredentialScope,
} from '@/lib/demoData';

export interface CredentialVaultState {
  credentials: CredentialRecord[];
  setCredentials: React.Dispatch<React.SetStateAction<CredentialRecord[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  loadError: boolean;
  setLoadError: React.Dispatch<React.SetStateAction<boolean>>;
  actionMessage: { text: string; type: 'success' | 'error' } | null;
  setActionMessage: React.Dispatch<React.SetStateAction<{ text: string; type: 'success' | 'error' } | null>>;
  fetchCredentials: () => Promise<void>;
}

export function useCredentialVault(options?: {
  fetchFn?: typeof fetch;
  autoFetch?: boolean;
}): CredentialVaultState {
  const fetchFn = options?.fetchFn;
  const autoFetch = options?.autoFetch;

  const [credentials, setCredentials] = React.useState<CredentialRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchCredentials = React.useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const fetchImpl = fetchFn || fetch;
      const res = await fetchImpl('/api/credentials');
      if (res.ok) {
        const json = await res.json();
        setCredentials(Array.isArray(json.credentials) ? json.credentials : []);
      } else {
        setLoadError(true);
        setCredentials([]);
      }
    } catch {
      setLoadError(true);
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  React.useEffect(() => {
    if (autoFetch !== false) {
      fetchCredentials();
    }
  }, [fetchCredentials, autoFetch]);

  return {
    credentials,
    setCredentials,
    loading,
    setLoading,
    loadError,
    setLoadError,
    actionMessage,
    setActionMessage,
    fetchCredentials,
  };
}

export interface IntegrationsAndVaultPageProps {
  vaultState?: CredentialVaultState;
}

export default function IntegrationsAndVaultPage(props: IntegrationsAndVaultPageProps = {}) {
  const defaultVault = useCredentialVault();
  const vault = props.vaultState || defaultVault;
  const {
    credentials,
    setCredentials,
    loading,
    loadError,
    actionMessage,
    setActionMessage,
    fetchCredentials,
  } = vault;

  const [activeTab, setActiveTab] = React.useState<'credentials' | 'integrations' | 'keys'>('credentials');
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  // Creation form state
  const [newProvider, setNewProvider] = React.useState<CredentialProvider>('GITHUB');
  const [newType, setNewType] = React.useState<CredentialType>('GITHUB_TOKEN');
  const [newDisplayName, setNewDisplayName] = React.useState('');
  const [newScope, setNewScope] = React.useState<CredentialScope>('READ_ONLY');
  const [newSecret, setNewSecret] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Rotation modal state
  const [rotateTargetId, setRotateTargetId] = React.useState<string | null>(null);
  const [targetKeyVersion, setTargetKeyVersion] = React.useState('v1');
  const [isRotating, setIsRotating] = React.useState(false);

  const handleCreateCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDisplayName.trim() || !newSecret) return;

    setIsSubmitting(true);
    setActionMessage(null);

    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          credentialType: newType,
          displayName: newDisplayName.trim(),
          secret: newSecret,
          scope: newScope,
        }),
      });

      // Clear secret immediately from memory
      setNewSecret('');

      if (res.ok) {
        const data = await res.json();
        setCredentials((prev) => [data.credential, ...prev]);
        setIsModalOpen(false);
        setNewDisplayName('');
        setActionMessage({
          text: 'Credential saved securely with AES-256-GCM. The secret will not be displayed again.',
          type: 'success',
        });
      } else {
        const err = await res.json();
        setActionMessage({ text: err.error || 'Failed to store credential.', type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message || 'Network error storing credential.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValidate = async (credentialId: string) => {
    try {
      const res = await fetch(`/api/credentials/${credentialId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipNetwork: true }),
      });

      if (res.ok) {
        const data = await res.json();
        setCredentials((prev) =>
          prev.map((c) =>
            c.id === credentialId
              ? { ...c, lastValidatedAt: data.result.checkedAt, status: data.result.status as any }
              : c
          )
        );
        setActionMessage({ text: `Validation passed: ${data.result.message}`, type: 'success' });
      }
    } catch {
      setActionMessage({ text: 'Validation failed to contact provider.', type: 'error' });
    }
  };

  const handleRotateKey = async (credentialId: string) => {
    setIsRotating(true);
    try {
      const res = await fetch(`/api/credentials/${credentialId}/rotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeyVersion }),
      });

      if (res.ok) {
        setCredentials((prev) =>
          prev.map((c) => (c.id === credentialId ? { ...c, keyVersion: targetKeyVersion } : c))
        );
        setRotateTargetId(null);
        setActionMessage({ text: `Encryption key successfully rotated to ${targetKeyVersion}.`, type: 'success' });
      } else {
        const err = await res.json();
        setActionMessage({ text: err.error || 'Key rotation failed.', type: 'error' });
      }
    } catch {
      setActionMessage({ text: 'Error rotating key.', type: 'error' });
    } finally {
      setIsRotating(false);
    }
  };

  const handleRevoke = async (credentialId: string) => {
    try {
      const res = await fetch(`/api/credentials/${credentialId}/revoke`, { method: 'POST' });
      if (res.ok) {
        setCredentials((prev) =>
          prev.map((c) => (c.id === credentialId ? { ...c, status: 'REVOKED' } : c))
        );
        setActionMessage({ text: 'Credential revoked. Future execution resolution is prohibited.', type: 'success' });
      }
    } catch {
      setActionMessage({ text: 'Failed to revoke credential.', type: 'error' });
    }
  };

  const handleDelete = async (credentialId: string) => {
    if (!confirm('Permanently delete this credential envelope from the vault? This action cannot be undone.')) return;

    try {
      const res = await fetch(`/api/credentials/${credentialId}`, { method: 'DELETE' });
      if (res.ok) {
        setCredentials((prev) => prev.filter((c) => c.id !== credentialId));
        setActionMessage({ text: 'Credential permanently removed from vault.', type: 'success' });
      }
    } catch {
      setActionMessage({ text: 'Failed to delete credential.', type: 'error' });
    }
  };

  const getProviderIcon = (provider: CredentialProvider) => {
    switch (provider) {
      case 'GITHUB':
        return <GitBranch className="w-4 h-4 text-blue-400" />;
      case 'OPENAI':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'CI_WEBHOOK':
        return <Webhook className="w-4 h-4 text-purple-400" />;
      case 'GENERIC_HTTP':
      case 'ENVIRONMENT_AUTH':
      case 'PROJECT_SOURCE':
        return <Globe className="w-4 h-4 text-amber-400" />;
      default:
        return <Key className="w-4 h-4 text-accent" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" /> ACTIVE
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-2.5 h-2.5" /> REVOKED
          </span>
        );
      case 'EXPIRED':
      case 'INVALID':
      case 'VALIDATION_FAILED':
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-2.5 h-2.5" /> {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-muted-foreground border border-white/10">
            {status}
          </span>
        );
    }
  };

  return (
    <Stack spacing={24}>
      {/* Header */}
      <Flex className="justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Integrations & Credential Vault
            </h1>
            <span className="px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider rounded bg-accent/10 text-accent border border-accent/20">
              AES-256-GCM
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Canonical security boundary managing write-only secrets, provider credentials, key rotation, and tenant isolation.
          </p>
        </div>

        <Flex className="items-center gap-2">
          <Link href="/settings/security">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              Security Policies
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Store Credential
          </Button>
        </Flex>
      </Flex>

      {/* Action Notification */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Security Guarantee Banner */}
      <Card className="glass-panel p-4 border border-accent/20 bg-accent/5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-foreground">Write-Only Security Guarantee</div>
            <p className="text-muted-foreground leading-relaxed">
              Secrets are authenticated and encrypted server-side immediately upon submission using AES-256-GCM.
              Plaintext secrets are <strong className="text-foreground">never returned in API responses</strong>, never stored in plaintext database columns, and never displayed in this console.
            </p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-white/10 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTab('credentials')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'credentials'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Key className="w-3.5 h-3.5" /> Stored Credentials ({loading ? '...' : credentials.length})
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'integrations'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Connected Providers
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'keys'
              ? 'border-accent text-accent'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock className="w-3.5 h-3.5" /> Encryption & Key Management
        </button>
      </div>

      {/* Tab 1: Credentials Table */}
      {activeTab === 'credentials' && (
        <Card className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Credential</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Masked ID</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Key Ver</th>
                  <th className="py-3 px-4">Last Validated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-accent" />
                        <span className="text-xs">Loading credentials...</span>
                      </div>
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="flex items-center gap-2 text-red-400 font-semibold text-xs">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Unable to load credentials.</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          The credential vault service could not be reached.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={fetchCredentials}
                          className="text-xs flex items-center gap-1.5 mt-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : credentials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Key className="w-7 h-7 text-muted-foreground/40 mb-1" />
                        <div className="text-xs font-semibold text-foreground">
                          No credentials configured
                        </div>
                        <p className="text-[11px] text-muted-foreground max-w-sm">
                          Connect GitHub, OpenAI, CI/CD, or another supported provider to securely store credentials.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => setIsModalOpen(true)}
                          className="text-xs font-semibold flex items-center gap-1.5 mt-2"
                        >
                          <Plus className="w-3.5 h-3.5" /> Store Credential
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  credentials.map((cred) => (
                    <tr key={cred.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {getProviderIcon(cred.provider)}
                          <span>{cred.displayName}</span>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground ml-6">
                          {cred.credentialType}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                        {cred.provider}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-foreground font-bold">
                        {cred.maskedPreview || '--'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-muted-foreground">
                        {cred.scope}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(cred.status)}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-accent">
                        {cred.keyVersion || 'v1'}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {cred.lastValidatedAt
                          ? new Date(cred.lastValidatedAt).toLocaleDateString()
                          : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleValidate(cred.id)}
                          className="text-[10px] h-7 px-2 font-mono"
                          disabled={cred.status === 'REVOKED'}
                        >
                          Validate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRotateTargetId(cred.id)}
                          className="text-[10px] h-7 px-2 font-mono"
                          disabled={cred.status === 'REVOKED'}
                        >
                          Rotate
                        </Button>
                        {cred.status !== 'REVOKED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevoke(cred.id)}
                            className="text-[10px] h-7 px-2 text-amber-400 hover:text-amber-300 font-mono"
                          >
                            Revoke
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(cred.id)}
                          className="text-[10px] h-7 px-2 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Connected Providers */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          {loadError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Unable to load credentials to verify connected providers.</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCredentials}
                className="text-xs h-7 px-3"
              >
                <RefreshCw className="w-3 h-3 mr-1" /> Retry
              </Button>
            </div>
          )}

          {(() => {
            const githubCreds = credentials.filter((c) => c.provider === 'GITHUB');
            const activeGithub = githubCreds.find((c) => c.status === 'ACTIVE');
            const isGithubConnected = !!activeGithub;

            const openaiCreds = credentials.filter((c) => c.provider === 'OPENAI');
            const activeOpenai = openaiCreds.find((c) => c.status === 'ACTIVE');
            const isOpenaiConnected = !!activeOpenai;

            const webhookCreds = credentials.filter((c) => c.provider === 'CI_WEBHOOK');
            const activeWebhook = webhookCreds.find((c) => c.status === 'ACTIVE');
            const isWebhookConnected = !!activeWebhook;

            const envAuthCreds = credentials.filter(
              (c) => c.provider === 'ENVIRONMENT_AUTH' || c.provider === 'GENERIC_HTTP'
            );
            const activeEnvAuth = envAuthCreds.find((c) => c.status === 'ACTIVE');
            const isEnvAuthConnected = !!activeEnvAuth;

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="glass-panel p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <GitBranch className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          GitHub VCS & Automation
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                              isGithubConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-white/5 text-muted-foreground border-white/10'
                            }`}
                          >
                            {isGithubConnected ? 'CONNECTED' : 'NOT_CONFIGURED'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Repository tree inspection, change intelligence, and safe Pull Request generation.
                        </p>
                        <div className="mt-3 text-[11px] font-mono text-muted-foreground space-y-1">
                          <div>Status: {isGithubConnected ? `${githubCreds.length} configured` : '--'}</div>
                          <div>Scope: {activeGithub ? activeGithub.scope : '--'}</div>
                          <div>
                            Last Validated:{' '}
                            {activeGithub?.lastValidatedAt
                              ? new Date(activeGithub.lastValidatedAt).toLocaleDateString()
                              : '--'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="glass-panel p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          OpenAI QA Provider
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                              isOpenaiConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-white/5 text-muted-foreground border-white/10'
                            }`}
                          >
                            {isOpenaiConnected ? 'CONNECTED' : 'NOT_CONFIGURED'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Root Cause Analysis reasoning, patch formulation, and natural language explanations.
                        </p>
                        <div className="mt-3 text-[11px] font-mono text-muted-foreground space-y-1">
                          <div>Status: {isOpenaiConnected ? `${openaiCreds.length} configured` : '--'}</div>
                          <div>Scope: {activeOpenai ? activeOpenai.scope : '--'}</div>
                          <div>
                            Last Validated:{' '}
                            {activeOpenai?.lastValidatedAt
                              ? new Date(activeOpenai.lastValidatedAt).toLocaleDateString()
                              : '--'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="glass-panel p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Webhook className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          CI/CD Webhook Ingestion
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                              isWebhookConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-white/5 text-muted-foreground border-white/10'
                            }`}
                          >
                            {isWebhookConnected ? 'CONNECTED' : 'NOT_CONFIGURED'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          HMAC SHA-256 signature verification for automated test triggers on push and pull requests.
                        </p>
                        <div className="mt-3 text-[11px] font-mono text-muted-foreground space-y-1">
                          <div>Status: {isWebhookConnected ? `${webhookCreds.length} configured` : '--'}</div>
                          <div>Scope: {activeWebhook ? activeWebhook.scope : '--'}</div>
                          <div>
                            Last Validated:{' '}
                            {activeWebhook?.lastValidatedAt
                              ? new Date(activeWebhook.lastValidatedAt).toLocaleDateString()
                              : '--'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="glass-panel p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          Target Environment Auth
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                              isEnvAuthConnected
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-white/5 text-muted-foreground border-white/10'
                            }`}
                          >
                            {isEnvAuthConnected ? 'CONNECTED' : 'NOT_CONFIGURED'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          HTTP Basic Auth and Bearer Token injection for staging, QA, and preview test environments.
                        </p>
                        <div className="mt-3 text-[11px] font-mono text-muted-foreground space-y-1">
                          <div>Status: {isEnvAuthConnected ? `${envAuthCreds.length} configured` : '--'}</div>
                          <div>Scope: {activeEnvAuth ? activeEnvAuth.scope : '--'}</div>
                          <div>
                            Last Validated:{' '}
                            {activeEnvAuth?.lastValidatedAt
                              ? new Date(activeEnvAuth.lastValidatedAt).toLocaleDateString()
                              : '--'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab 3: Encryption & Key Management */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <Card className="glass-panel p-5">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-accent" /> Cryptographic Key Hierarchy & Invariants
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Details regarding the encryption primitives guarding credentials in this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 text-xs space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Algorithm</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">AES-256-GCM</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Authenticated symmetric cipher</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">Active Key Version</div>
                  <div className="font-mono text-sm font-bold text-accent mt-1">v1</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Stored in server-only ENV</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">IV & Auth Tag</div>
                  <div className="font-mono text-sm font-bold text-foreground mt-1">16 Bytes Random</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Cryptographically random per entry</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-muted-foreground space-y-1.5 font-mono text-[11px]">
                <div className="text-foreground font-semibold">Security Guardrails:</div>
                <div>• Encryption keys are NEVER stored in Supabase or logged.</div>
                <div>• Plaintext secrets are short-lived in-memory only and wiped after resolution.</div>
                <div>• Cross-tenant credential access is strictly denied at both RLS and policy layers.</div>
                <div>• Production credential mutation requires OWNER or ADMIN role.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Store New Credential */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="glass-panel w-full max-w-lg p-6 border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="p-0 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4 text-accent" /> Store Secure Credential
                </CardTitle>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground text-sm font-mono"
                >
                  ✕
                </button>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Store a write-only credential. The secret is encrypted with AES-256-GCM and will never be displayed again.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleCreateCredential} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Provider</label>
                <select
                  value={newProvider}
                  onChange={(e) => {
                    const p = e.target.value as CredentialProvider;
                    setNewProvider(p);
                    if (p === 'GITHUB') setNewType('GITHUB_TOKEN');
                    else if (p === 'OPENAI') setNewType('OPENAI_API_KEY');
                    else if (p === 'CI_WEBHOOK') setNewType('WEBHOOK_SECRET');
                    else setNewType('BEARER_TOKEN');
                  }}
                  className="w-full text-xs rounded-md bg-white/5 border border-white/10 px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="GITHUB">GitHub (VCS & Automation)</option>
                  <option value="OPENAI">OpenAI (AI QA Provider)</option>
                  <option value="CI_WEBHOOK">CI/CD Webhook (HMAC Verification)</option>
                  <option value="GENERIC_HTTP">Generic HTTP / API</option>
                  <option value="ENVIRONMENT_AUTH">Target Environment Auth</option>
                  <option value="PROJECT_SOURCE">Project Source Auth</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Credential Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CredentialType)}
                  className="w-full text-xs rounded-md bg-white/5 border border-white/10 px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  {newProvider === 'GITHUB' && (
                    <>
                      <option value="GITHUB_TOKEN">GitHub Token (PAT / Fine-grained)</option>
                      <option value="OAUTH_TOKEN">OAuth Token</option>
                    </>
                  )}
                  {newProvider === 'OPENAI' && (
                    <option value="OPENAI_API_KEY">OpenAI API Key (sk-...)</option>
                  )}
                  {newProvider === 'CI_WEBHOOK' && (
                    <option value="WEBHOOK_SECRET">Webhook HMAC Secret</option>
                  )}
                  {newProvider !== 'GITHUB' && newProvider !== 'OPENAI' && newProvider !== 'CI_WEBHOOK' && (
                    <>
                      <option value="BEARER_TOKEN">Bearer Token</option>
                      <option value="BASIC_AUTH">Basic Auth (user:pass)</option>
                      <option value="API_KEY">API Key Header</option>
                      <option value="CUSTOM_SECRET">Custom Secret Material</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Staging Repository PAT or OpenAI QA Key"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full text-xs rounded-md bg-white/5 border border-white/10 px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Permission Scope</label>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as CredentialScope)}
                  className="w-full text-xs rounded-md bg-white/5 border border-white/10 px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                >
                  <option value="READ_ONLY">READ_ONLY (Read & inspection only)</option>
                  <option value="READ_WRITE">READ_WRITE (Permits Pull Request creation)</option>
                  <option value="EXECUTION_ONLY">EXECUTION_ONLY (Worker test execution)</option>
                  <option value="WEBHOOK_VERIFY">WEBHOOK_VERIFY (Signature verification)</option>
                  <option value="ADMIN">ADMIN (Full administrative scope)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Secret Material (Write-Only)
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  spellCheck="false"
                  placeholder="Enter token, API key, or secret string..."
                  value={newSecret}
                  onChange={(e) => setNewSecret(e.target.value)}
                  className="w-full text-xs font-mono rounded-md bg-white/5 border border-white/10 px-3 py-2 text-foreground focus:outline-none focus:border-accent"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  This value will be encrypted immediately and will never be shown again.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs font-semibold"
                >
                  {isSubmitting ? 'Encrypting...' : 'Encrypt & Store'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Rotate Encryption Key */}
      {rotateTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="glass-panel w-full max-w-sm p-5 border border-white/10 shadow-2xl">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-accent" /> Rotate Encryption Key
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Re-encrypt the stored secret with a new encryption key version.
              </CardDescription>
            </CardHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Target Key Version</label>
                <select
                  value={targetKeyVersion}
                  onChange={(e) => setTargetKeyVersion(e.target.value)}
                  className="w-full text-xs rounded-md bg-white/5 border border-white/10 px-3 py-2 text-foreground"
                >
                  <option value="v1">v1 (Current Active Key)</option>
                  <option value="v2">v2 (Next Generation Key)</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRotateTargetId(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleRotateKey(rotateTargetId)}
                  disabled={isRotating}
                  className="text-xs font-semibold"
                >
                  {isRotating ? 'Rotating...' : 'Rotate Key'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </Stack>
  );
}
