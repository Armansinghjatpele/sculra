'use client';

import * as React from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import { AppShell } from '@/components/AppShell';
import { Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';

export default function TeamPage() {
  const { organization, memberships, isLoaded } = useOrganization({
    memberships: {
      pageSize: 20,
    },
  });
  const { user } = useUser();

  return (
    <>
      <Stack spacing={24}>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Organization Team</h1>
          <p className="text-xs text-muted-foreground">Manage organization members and workspace access permissions.</p>
        </div>

        {!isLoaded ? (
          <div className="py-12 text-center text-xs text-muted-foreground font-mono">
            Loading team members...
          </div>
        ) : !organization ? (
          /* PERSONAL WORKSPACE DISPLAY */
          <Card className="glass-panel p-8 text-center max-w-md mx-auto space-y-4 my-8">
            <div className="text-xs font-bold text-foreground">Personal Workspace</div>
            <p className="text-3xs text-muted-foreground leading-relaxed">
              You are currently in your personal sandbox workspace. Create or select a Clerk Organization via the workspace switcher in the sidebar to invite team members.
            </p>
            {user && (
              <div className="pt-4 border-t border-white/5 flex items-center justify-between text-left font-mono text-[10px]">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-accent">
                    {user.firstName?.charAt(0)}
                  </div>
                  <div>
                    <span className="text-foreground font-semibold block">{user.fullName}</span>
                    <span className="text-muted-foreground block text-[9px]">{user.primaryEmailAddress?.emailAddress}</span>
                  </div>
                </div>
                <span className="px-1.5 py-0.5 bg-accent/15 text-accent border border-accent/20 rounded font-bold uppercase text-[8px]">
                  Owner
                </span>
              </div>
            )}
          </Card>
        ) : (
          /* ORGANIZATION DISPLAY */
          <div className="overflow-x-auto border border-white/5 rounded-xl bg-zinc-950/40">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase text-muted-foreground">
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-[11px]">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {memberships?.data?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-white/5">
                    <td className="p-4 text-foreground font-semibold flex items-center gap-2">
                      {m.publicUserData.imageUrl ? (
                        <img src={m.publicUserData.imageUrl} className="h-5 w-5 rounded-full border border-white/10" alt="Avatar" />
                      ) : (
                        <div className="h-5 w-5 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-accent text-[9px]">
                          {m.publicUserData.firstName?.charAt(0)}
                        </div>
                      )}
                      <span>{m.publicUserData.firstName} {m.publicUserData.lastName}</span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {m.publicUserData.identifier || 'No verified email'}
                    </td>
                    <td className="p-4 uppercase text-accent font-bold">
                      {m.role === 'org:admin' ? 'Admin' : m.role === 'org:member' ? 'Member' : m.role}
                    </td>
                    <td className="p-4">
                      <span className="px-1.5 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded text-[8px] font-bold uppercase tracking-wider">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </>
  );
}
