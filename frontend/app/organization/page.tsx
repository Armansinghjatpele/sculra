'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack } from '@/components/LayoutPrimitives';
import { OrganizationPanel } from '@/components/OrganizationPanel';

export default function OrganizationPage() {
  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Workspace Organization</h1>
          <p className="text-xs text-muted-foreground">Manage organization membership settings and invites.</p>
        </div>
        <OrganizationPanel />
      </Stack>
    </AppShell>
  );
}
