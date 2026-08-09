import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export default function DashboardReleaseScorePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Release Scores</h1>
        <p className="text-sm text-muted-foreground">Historical QA stability scores mapped by git release version tags.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Release v1.2.0 - A+ (98/100)</CardTitle>
            <CardDescription>Verified on 2026-08-07 - stability checks passed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
