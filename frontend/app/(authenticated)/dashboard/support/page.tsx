import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import { Button } from '@/components/Button';

export default function DashboardSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Support</h1>
        <p className="text-sm text-muted-foreground">Submit feedback or request specialized QA testing guidelines.</p>
      </div>

      <Card className="glass-panel max-w-xl">
        <CardHeader>
          <CardTitle>Submit Ticket</CardTitle>
          <CardDescription>File a ticket and our engineers will respond in 24 hours.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
