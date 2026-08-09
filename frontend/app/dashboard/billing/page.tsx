import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';

export default function DashboardBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage subscriptions and Stripe payment portals.</p>
      </div>

      <Card className="glass-panel max-w-xl">
        <CardHeader>
          <CardTitle>Professional Plan</CardTitle>
          <CardDescription>Active billing cycle renewal: September 7, 2026 ($199/mo).</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Button variant="outline">Manage Billing in Stripe</Button>
        </CardContent>
      </Card>
    </div>
  );
}
