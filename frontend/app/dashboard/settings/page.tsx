import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import { Button } from '@/components/Button';

export default function DashboardSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Provision workspace controls and webhook endpoints.</p>
      </div>

      <Card className="glass-panel max-w-xl">
        <CardHeader>
          <CardTitle>Workspace Isolation</CardTitle>
          <CardDescription>Multi-tenancy configuration and org preferences.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
