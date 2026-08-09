import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export default function DashboardReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">QA Reports</h1>
        <p className="text-sm text-muted-foreground">Review test session analytics and detailed reports.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Report #3 - Passed</CardTitle>
            <CardDescription>Generated on 2026-08-07T12:00:00Z - My App Core</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
