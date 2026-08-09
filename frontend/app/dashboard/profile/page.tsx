import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export default function DashboardProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">User Profile</h1>
        <p className="text-sm text-muted-foreground">Manage profile credentials and preferences.</p>
      </div>

      <Card className="glass-panel max-w-xl">
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Setup name, avatar icon, and workspace notifications.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
