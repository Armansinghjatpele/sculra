'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack } from '@/components/LayoutPrimitives';
import { EmptyState } from '@/components/EmptyState';

export default function ReportsPage() {
  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-xs text-muted-foreground">Comprehensive system audits and security compliance PDF outputs.</p>
        </div>
        <EmptyState
          title="No reports compiled yet"
          description="Reports are generated automatically upon completing automated project builds or security runs."
          actionText="Learn about Reports"
          onAction={() => window.open('/docs')}
        />
      </Stack>
    </AppShell>
  );
}
