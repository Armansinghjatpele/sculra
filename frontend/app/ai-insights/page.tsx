'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack, Grid } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { AIInsightsWidget } from '@/components/DashboardWidgets';

export default function AIInsightsPage() {
  const insights = [
    {
      id: 'ins-1',
      agent: 'Security Inspector Agent',
      severity: 'warning' as const,
      finding: 'Missing HttpOnly flag in session cookie in sculra-monorepo.',
      recommendation: 'Configure response headers to append HttpOnly cookie configuration values.',
    },
    {
      id: 'ins-2',
      agent: 'UX Accessibility Agent',
      severity: 'warning' as const,
      finding: 'Secondary button element contrast ratio is below 4.5:1 (WCAG AA requirement).',
      recommendation: 'Adjust foreground slate color values to enhance contrast on dark backdrops.',
    },
  ];

  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">AI Insights</h1>
          <p className="text-xs text-muted-foreground">Automated bug diagnoses and improvements from autonomous QA agents.</p>
        </div>

        <Grid cols={1} colsMd={2} gap={16}>
          <AIInsightsWidget insights={insights} />
          
          <Card className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Autonomous Inspector Actions</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Sculra inspects your active branches, web endpoints, and local deployments continuously. Toggle auto-diagnostic agents within settings workspace tabs.
            </p>
          </Card>
        </Grid>
      </Stack>
    </AppShell>
  );
}
