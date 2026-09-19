'use client';

import * as React from 'react';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { CheckCircle2, GitBranch, Key, Database } from 'lucide-react';
import Link from 'next/link';

export default function IntegrationsSettingsPage() {
  const integrations = [
    {
      id: 'clerk',
      name: 'Clerk Authentication & Organizations',
      description: 'Single sign-on, multi-factor authentication, and organization membership synchronization.',
      status: 'Connected',
      icon: <Key className="w-5 h-5 text-accent" />,
      connectedSince: 'Active in session',
    },
    {
      id: 'supabase',
      name: 'Supabase PostgreSQL & RLS',
      description: 'Multi-tenant database persistence with Row Level Security boundaries.',
      status: 'Connected',
      icon: <Database className="w-5 h-5 text-emerald-400" />,
      connectedSince: 'Active in cluster',
    },
    {
      id: 'github',
      name: 'GitHub VCS & Webhook Gate',
      description: 'Repository tree analysis, commit change intelligence, and CI/CD pull request gating.',
      status: 'Connected',
      icon: <GitBranch className="w-5 h-5 text-blue-400" />,
      connectedSince: 'Configured on projects',
    },
  ];

  return (
    <Stack spacing={24}>
      <Flex className="justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Platform Integrations
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage third-party connections powering authentication, multi-tenant databases, and version control.
          </p>
        </div>

        <Link href="/settings/security">
          <Button variant="outline" size="sm" className="text-xs font-semibold">
            View Security Policies
          </Button>
        </Link>
      </Flex>

      <div className="grid grid-cols-1 gap-4">
        {integrations.map((item) => (
          <Card key={item.id} className="glass-panel p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  {item.icon}
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    {item.name}
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                  <div className="text-[10px] font-mono text-muted-foreground mt-2">
                    Status: {item.connectedSince}
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                <Button variant="outline" size="sm" disabled className="text-xs">
                  Configure
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </Stack>
  );
}
