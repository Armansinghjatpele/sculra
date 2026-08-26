'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { TestRunTable } from '@/components/TestRunTable';
import { mockTestRuns } from '@/lib/demoData';

export default function TestRunsPage() {
  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Test Runs</h1>
          <p className="text-xs text-muted-foreground">Historical list of AI agent testing execution runs.</p>
        </div>
        <TestRunTable runs={mockTestRuns} />
      </Stack>
    </AppShell>
  );
}
