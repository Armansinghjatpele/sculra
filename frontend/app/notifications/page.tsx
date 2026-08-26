'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack } from '@/components/LayoutPrimitives';
import { NotificationList } from '@/components/NotificationList';
import { mockNotifications } from '@/lib/demoData';

export default function NotificationsPage() {
  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Notifications Hub</h1>
          <p className="text-xs text-muted-foreground">Manage your test runs alerts and security warning triggers.</p>
        </div>
        <NotificationList notifications={mockNotifications} />
      </Stack>
    </AppShell>
  );
}
