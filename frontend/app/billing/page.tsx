'use client';

import * as React from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack, Grid } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Button } from '@/components/Button';

export default function BillingPage() {
  const plans = [
    { name: 'Developer Starter', price: '$0', description: 'Free forever. 100 test runs / month, 1 active workspace.', current: true },
    { name: 'Pro Workspace', price: '$49', description: 'Everything in Free plus 2,000 test runs, parallel runs, 5 members.', current: false },
    { name: 'Enterprise Scale', price: 'Custom', description: 'Unlimited workspaces, dedicated execution runners, custom security audits.', current: false },
  ];

  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Billing Plans</h1>
          <p className="text-xs text-muted-foreground">Manage subscription plans, billing details, and workspace limits.</p>
        </div>

        <Grid cols={1} colsMd={3} gap={16}>
          {plans.map((plan) => (
            <Card key={plan.name} className={`glass-panel flex flex-col justify-between ${plan.current ? 'border-accent' : ''}`}>
              <CardHeader>
                <CardTitle className="text-sm font-bold">{plan.name}</CardTitle>
                <div className="text-2xl font-bold text-foreground mt-2">{plan.price}</div>
                <CardDescription className="text-3xs text-muted-foreground leading-normal mt-2">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-4 border-t border-border/20 mt-4">
                <Button variant={plan.current ? 'outline' : 'accent'} size="sm" className="w-full" disabled={plan.current}>
                  {plan.current ? 'Active Subscription' : 'Upgrade Plan'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </Grid>
      </Stack>
    </AppShell>
  );
}
