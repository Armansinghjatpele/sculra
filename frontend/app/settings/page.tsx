'use client';

import * as React from 'react';
import { use } from 'react';
import { AppShell } from '@/components/AppShell';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { SettingsNavigation } from '@/components/SettingsNavigation';

interface SettingsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default function SettingsPage({ searchParams }: SettingsPageProps) {
  // Resolve searchParams promise (standard Next.js App Router behavior)
  const resolvedSearchParams = use(searchParams);
  const tab = resolvedSearchParams.tab || 'profile';

  return (
    <AppShell>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Console Settings</h1>
          <p className="text-xs text-muted-foreground">Manage profile, interface preferences, and organization settings.</p>
        </div>

        <Flex className="gap-6 flex-col md:flex-row items-start">
          <SettingsNavigation />
          
          <div className="flex-1 w-full">
            {tab === 'profile' && (
              <Card className="glass-panel w-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">User Profile</CardTitle>
                  <CardDescription className="text-4xs">Update your profile parameters (Clerk synced)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Full Name</label>
                    <Input placeholder="Developer User" disabled />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Primary Email Address</label>
                    <Input placeholder="user@sculra.io" disabled />
                  </div>
                </CardContent>
                <CardFooter className="border-t border-border/20 pt-4 flex justify-end">
                  <Button variant="outline" size="sm" disabled>Save Preferences</Button>
                </CardFooter>
              </Card>
            )}

            {tab !== 'profile' && (
              <Card className="glass-panel w-full p-8 text-center text-xs text-muted-foreground">
                Settings tab: "{tab}" shell foundation. Sync config actions mapped.
              </Card>
            )}
          </div>
        </Flex>
      </Stack>
    </AppShell>
  );
}
