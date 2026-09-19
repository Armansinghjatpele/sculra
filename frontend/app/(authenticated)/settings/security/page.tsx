'use client';

import * as React from 'react';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { RoleBadge } from '@/components/authz/RoleBadge';
import { Button } from '@/components/Button';
import { Shield, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function SecuritySettingsPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadSecurity() {
      try {
        setLoading(true);
        const res = await fetch('/api/settings/security');
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || 'Failed loading security settings');
        }
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSecurity();
  }, []);

  return (
    <Stack spacing={24}>
      {/* Header */}
      <Flex className="justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Security & Governance Controls
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Factual security posture, sensitive action enforcement, and multi-tenant isolation parameters.
          </p>
        </div>

        <Link href="/settings/permissions">
          <Button variant="outline" size="sm" className="text-xs font-semibold">
            Inspect Permissions Matrix
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </Link>
      </Flex>

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-xs text-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-mono text-muted-foreground">
          Loading security parameters...
        </div>
      ) : data ? (
        <>
          {/* Identity & Current Role Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="glass-panel p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Your Active Identity</div>
              <div className="flex items-center justify-between">
                <RoleBadge role={data.caller.role} size="md" />
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-green-500/10 text-green-400 border border-green-500/20">
                  {data.caller.status}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Holding <span className="text-foreground font-semibold font-mono">{data.caller.permissionsCount}</span> active permissions in this organization.
              </p>
            </Card>

            <Card className="glass-panel p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Organization Members</div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {data.membersSummary.total}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {data.membersSummary.active} active • {data.membersSummary.invited} invited • {data.membersSummary.ownersCount} owner(s)
              </p>
            </Card>

            <Card className="glass-panel p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Pending Human Approvals</div>
              <div className="text-2xl font-bold font-mono text-foreground">
                {data.pendingApprovalsCount}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Cryptographically bound remediation plans requiring operator confirmation.
              </p>
            </Card>
          </div>

          {/* Sensitive Action Policies Card */}
          <Card className="glass-panel overflow-hidden">
            <CardHeader className="p-4 bg-white/5 border-b border-white/5">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-accent" />
                Active Security Policies & Ceilings
              </CardTitle>
              <CardDescription className="text-[10px] text-muted-foreground">
                System and project policies actively enforced on autonomous actions and mutations.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-foreground font-semibold">Safe Fix Agent Human Approval</div>
                  <div className="text-[10px] text-muted-foreground font-sans">
                    Requires 24-hour cryptographically bound human approval before patch apply & PR publication.
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                  {data.sensitivePolicies.fixAgentApprovalRequired ? 'Enforced' : 'Optional'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-foreground font-semibold">Target Branch Restrictions</div>
                  <div className="text-[10px] text-muted-foreground font-sans">
                    Fix Agent remediations restricted to designated project branches.
                  </div>
                </div>
                <div className="flex gap-1">
                  {data.sensitivePolicies.fixAgentAllowedBranches.map((b: string) => (
                    <span key={b} className="px-1.5 py-0.5 rounded text-[9px] bg-white/5 border border-white/10 text-zinc-300">
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <div className="text-foreground font-semibold">SSRF Hop Inspection Ceiling</div>
                  <div className="text-[10px] text-muted-foreground font-sans">
                    Maximum redirect hops verified for private IP ranges and cloud metadata.
                  </div>
                </div>
                <span className="text-accent font-bold">
                  {data.sensitivePolicies.ssrfHopLimit} hops max
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-foreground font-semibold">Owner Safety Invariant</div>
                  <div className="text-[10px] text-muted-foreground font-sans">
                    Prevents accidental deletion or self-demotion leaving zero organization owners.
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
                  Enforced
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Active Integrations */}
          <Card className="glass-panel overflow-hidden">
            <CardHeader className="p-4 bg-white/5 border-b border-white/5">
              <CardTitle className="text-xs font-bold text-foreground">
                Connected Security & Identity Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 divide-y divide-white/5 font-mono text-xs">
              {data.activeIntegrations.map((item: any) => (
                <div key={item.name} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-foreground font-semibold">{item.name}</span>
                      <span className="ml-2 text-[9px] text-muted-foreground uppercase">[{item.type}]</span>
                    </div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {item.status}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Factual Data Notice (Zero Fake Data Guarantee) */}
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Zero Fake Metrics Guarantee: </span>
            Sculra does not generate simulated compliance percentages, arbitrary risk scores, or synthetic uptime figures. All metrics above reflect actual cryptographic policies, session tokens, and database records.
          </div>
        </>
      ) : null}
    </Stack>
  );
}
