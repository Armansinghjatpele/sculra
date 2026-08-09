import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export default function DashboardNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">Stay updated on test failures and alert states.</p>
      </div>

      <div className="grid gap-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Bug discovered in sandbox_env_v1</CardTitle>
            <CardDescription>Detected 4 hours ago - Severity: High</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
