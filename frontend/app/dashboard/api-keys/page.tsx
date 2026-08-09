import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import { Button } from '@/components/Button';

export default function DashboardAPIKeysPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">API Keys</h1>
          <p className="text-sm text-muted-foreground">Provision secret keys for REST and CI integrations.</p>
        </div>
        <Button variant="accent">Generate API Key</Button>
      </div>

      <div className="grid gap-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>qap_live_7x89...</CardTitle>
            <CardDescription>Created on 2026-08-07 - active.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
