'use client';

import * as React from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card';
import { Badge } from './Badge';

export function OrganizationPanel() {
  const { organization, isLoaded } = useOrganization();
  const { user } = useUser();

  if (!isLoaded) {
    return <div className="text-xs text-muted-foreground">Loading organization...</div>;
  }

  // Fallback organization representation if not selected in Clerk
  const orgName = organization?.name || `${user?.fullName || 'Personal'}'s Workspace`;
  const orgLogo = organization?.imageUrl || '';

  return (
    <Card className="glass-panel w-full">
      <CardHeader className="flex flex-row items-center gap-4 pb-4 border-b border-border/30 mb-6">
        {orgLogo ? (
          <img src={orgLogo} alt={orgName} className="h-10 w-10 rounded object-cover border border-border" />
        ) : (
          <div className="h-10 w-10 rounded bg-primary flex items-center justify-center font-bold text-white text-sm select-none">
            {orgName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="space-y-0.5">
          <CardTitle className="text-base font-bold text-foreground">{orgName}</CardTitle>
          <CardDescription className="text-4xs text-muted-foreground uppercase tracking-widest font-semibold">
            {organization ? 'Organization Workspace' : 'Personal Workspace'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Members panel */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-foreground">Workspace Members</h3>
          <div className="space-y-2">
            {/* Renders current user row */}
            <div className="flex items-center justify-between p-3 border border-border/50 bg-muted/20 rounded-md">
              <div className="flex items-center gap-3">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={user.fullName || ''} className="h-7 w-7 rounded-full" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-accent/25 flex items-center justify-center text-xs font-bold">
                    U
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-foreground">{user?.fullName || 'Active User'}</p>
                  <p className="text-4xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <Badge variant="accent" className="text-5xs uppercase tracking-wider py-0.5 px-2">
                Owner
              </Badge>
            </div>
          </div>
        </div>

        {/* Invitations panel placeholder */}
        <div className="space-y-2.5 pt-4 border-t border-border/20">
          <h3 className="text-xs font-bold text-foreground">Pending Invitations</h3>
          <p className="text-xs text-muted-foreground leading-normal">
            No active member invitations. Create organization invites in the Workspace settings panel.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
