import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export default function DashboardTestHistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Test Run History</h1>
        <p className="text-sm text-muted-foreground">Historical list of manual and web hook test sessions.</p>
      </div>

      <div className="grid gap-4">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Session run_main_branch_3</CardTitle>
            <CardDescription>Triggered via Manual Web Console - passed 45/45 steps.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
