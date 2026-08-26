'use client';

import * as React from 'react';
import { use } from 'react';
import { useAuth, useUser, useOrganization } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  // Resolve searchParams promise (standard Next.js App Router behavior)
  const resolvedSearchParams = use(searchParams);
  const activeTab = resolvedSearchParams.tab || 'account';

  const { user } = useUser();
  const { organization } = useOrganization();

  const settingsTabs = [
    { title: 'Account', value: 'account' },
    { title: 'Workspace', value: 'workspace' },
    { title: 'Team', value: 'team', href: '/team' }, // Redirects to dedicated team page
    { title: 'Security', value: 'security' },
    { title: 'Notifications', value: 'notifications' },
    { title: 'Integrations', value: 'integrations' },
    { title: 'Billing', value: 'billing' },
  ];

  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Console Settings</h1>
          <p className="text-xs text-muted-foreground">Manage profile, interface preferences, and organization settings.</p>
        </div>

        <Flex className="gap-6 flex-col md:flex-row items-start">
          {/* Settings Left Navigation */}
          <nav className="flex flex-col space-y-1 md:w-48 shrink-0 w-full">
            {settingsTabs.map((t) => {
              const isActive = activeTab === t.value;
              if (t.href) {
                return (
                  <Link
                    key={t.value}
                    href={t.href}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all"
                  >
                    {t.title}
                  </Link>
                );
              }
              return (
                <Link
                  key={t.value}
                  href={`/settings?tab=${t.value}`}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 text-left',
                    isActive
                      ? 'bg-zinc-900 text-accent font-bold'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  {t.title}
                </Link>
              );
            })}
          </nav>
          
          {/* Settings Tab Content */}
          <div className="flex-1 w-full">
            {activeTab === 'account' && user && (
              <Card className="glass-panel w-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Account Profile</CardTitle>
                  <CardDescription className="text-4xs">Update your profile parameters (Clerk synced)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
                    <Input placeholder={user.fullName || 'Developer User'} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Primary Email Address</label>
                    <Input placeholder={user.primaryEmailAddress?.emailAddress || 'user@sculra.io'} disabled />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/20 pt-4 flex justify-end">
                  <Button variant="outline" size="sm" disabled>Save Preferences</Button>
                </CardFooter>
              </Card>
            )}

            {activeTab === 'workspace' && (
              <Card className="glass-panel w-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Workspace Configuration</CardTitle>
                  <CardDescription className="text-4xs">Manage current active multi-tenant workspace details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Workspace Name</label>
                    <Input placeholder={organization?.name || 'Personal Workspace'} disabled />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card className="glass-panel w-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Security Boundary Configurations</CardTitle>
                  <CardDescription className="text-4xs">Authentication flows and session parameters protection.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Identity Auth Provider</span>
                    <span className="text-foreground">Clerk OAuth Integration</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Allowed Social Logins</span>
                    <span className="text-accent font-semibold">Google, GitHub, Apple</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Credentials Storage</span>
                    <span className="text-success font-semibold">Zero Passwords Stored</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card className="glass-panel w-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Notifications Dispatch Options</CardTitle>
                  <CardDescription className="text-4xs">Verify when to dispatch build readiness updates.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Weekly quality metrics emails and Slack build alerts are synced.</p>
                </CardContent>
              </Card>
            )}

            {activeTab === 'integrations' && (
              <Card className="glass-panel w-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Integrations Workspace</CardTitle>
                  <CardDescription className="text-4xs">Connect external tools to your testing queue.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 font-mono text-[10px]">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">GitHub Actions App</span>
                    <span className="text-success">Connected</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-muted-foreground">Slack Integration</span>
                    <span className="text-muted-foreground">Not Connected</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vercel Integration</span>
                    <span className="text-muted-foreground">Not Connected</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'billing' && (
              <Card className="glass-panel w-full border-dashed border-accent/20 bg-accent/5">
                <CardHeader>
                  <CardTitle className="text-sm font-bold text-accent">Billing Tiers</CardTitle>
                  <CardDescription className="text-4xs text-accent">Payment provider configuration.</CardDescription>
                </CardHeader>
                <CardContent className="py-4">
                  <div className="inline-block px-2.5 py-1 border border-accent/20 bg-accent/10 rounded font-mono text-[10px] text-accent font-bold uppercase tracking-wider">
                    Coming Soon
                  </div>
                  <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                    Sculra billing services are currently under beta. Plan quotas remain free-tier defaults until finalized.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </Flex>
      </Stack>
    </AppShell>
  );
}
