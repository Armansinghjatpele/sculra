'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack, Grid } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { ReleaseScoreWidget } from '@/components/DashboardWidgets';

export default function ReleaseReadinessPage() {
  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Release Readiness</h1>
          <p className="text-xs text-muted-foreground">Stability scoring indicating readiness for production deployments.</p>
        </div>

        <Grid cols={1} colsMd={3} gap={16}>
          <ReleaseScoreWidget score={82} label="Production Readiness Score" />
          
          <Card className="glass-panel py-6 px-4">
            <CardHeader className="p-0 space-y-1">
              <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Active Blockers</CardDescription>
              <CardTitle className="text-2xl font-bold text-danger mt-1">1 Blocker</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4 text-xs text-muted-foreground">
              Vulnerability: Unhandled API connection timeout identified on REACT sandbox.
            </CardContent>
          </Card>

          <Card className="glass-panel py-6 px-4">
            <CardHeader className="p-0 space-y-1">
              <CardDescription className="text-4xs uppercase tracking-widest font-semibold">Release Status</CardDescription>
              <CardTitle className="text-2xl font-bold text-warning mt-1">Needs Review</CardTitle>
            </CardHeader>
            <CardContent className="p-0 mt-4 text-xs text-muted-foreground">
              Requires manual verification of open vulnerability before setting release tags.
            </CardContent>
          </Card>
        </Grid>
      </Stack>
    </AppShell>
  );
}
