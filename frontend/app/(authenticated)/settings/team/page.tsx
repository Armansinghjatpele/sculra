'use client';

import * as React from 'react';
import { useOrganization, useUser } from '@clerk/nextjs';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { RoleBadge } from '@/components/authz/RoleBadge';
import { PermissionButton } from '@/components/authz/PermissionButton';
import {
  SculraRole,
  ALL_ROLES,
  ROLE_RANKS,
  ROLE_METADATA,
  mapClerkRoleToSculra,
} from '@/lib/authz/roles';
import { PERMISSIONS } from '@/lib/authz/permissions';
import { hasPermission } from '@/lib/authz/role-permissions';
import { OrganizationMember } from '@/lib/demoData';
import { UserPlus, Trash2, Edit3, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import Link from 'next/link';

export default function TeamSettingsPage() {
  const { organization, membership } = useOrganization();
  const { user } = useUser();

  const [members, setMembers] = React.useState<OrganizationMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<SculraRole>('DEVELOPER');
  const [inviteSubmitting, setInviteSubmitting] = React.useState(false);

  // Role change modal state
  const [roleChangeTarget, setRoleChangeTarget] = React.useState<OrganizationMember | null>(null);
  const [newSelectedRole, setNewSelectedRole] = React.useState<SculraRole>('DEVELOPER');
  const [roleChangeSubmitting, setRoleChangeSubmitting] = React.useState(false);

  // Remove confirmation modal state
  const [removeTarget, setRemoveTarget] = React.useState<OrganizationMember | null>(null);
  const [removeSubmitting, setRemoveSubmitting] = React.useState(false);

  const currentUserRole: SculraRole = React.useMemo(() => {
    return mapClerkRoleToSculra(membership?.role);
  }, [membership?.role]);

  const canInvite = hasPermission(currentUserRole, PERMISSIONS.MEMBERS_INVITE);
  const canChangeRole = hasPermission(currentUserRole, PERMISSIONS.MEMBERS_CHANGE_ROLE);
  const canRemove = hasPermission(currentUserRole, PERMISSIONS.MEMBERS_REMOVE);

  const fetchMembers = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/settings/team/members');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed loading members');
      }
      setMembers(data.members || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Handle member invitation
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    try {
      setInviteSubmitting(true);
      setError(null);
      const res = await fetch('/api/settings/team/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed sending invitation');
      }

      setActionSuccess(`Invitation successfully dispatched to ${inviteEmail}.`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('DEVELOPER');
      await fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  // Handle role modification
  const handleRoleChange = async () => {
    if (!roleChangeTarget) return;

    try {
      setRoleChangeSubmitting(true);
      setError(null);
      const res = await fetch(`/api/settings/team/members/${roleChangeTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newSelectedRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed updating member role');
      }

      setActionSuccess(`Updated role for ${roleChangeTarget.displayName} to ${newSelectedRole}.`);
      setRoleChangeTarget(null);
      await fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRoleChangeSubmitting(false);
    }
  };

  // Handle member removal
  const handleRemove = async () => {
    if (!removeTarget) return;

    try {
      setRemoveSubmitting(true);
      setError(null);
      const res = await fetch(`/api/settings/team/members/${removeTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed removing member');
      }

      setActionSuccess(`Removed ${removeTarget.displayName} from organization.`);
      setRemoveTarget(null);
      await fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemoveSubmitting(false);
    }
  };

  return (
    <Stack spacing={24}>
      {/* Top Header */}
      <Flex className="justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Team & Members
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground font-mono">
              {members.length} members
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage organization collaborators, enterprise role assignments, and member access.
          </p>
        </div>

        <Flex className="gap-2">
          <Link href="/settings/permissions">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              <Shield className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
              Permission Matrix
            </Button>
          </Link>
          <PermissionButton
            permission={PERMISSIONS.MEMBERS_INVITE}
            userRole={currentUserRole}
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="text-xs font-semibold"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Invite Member
          </PermissionButton>
        </Flex>
      </Flex>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-between text-xs text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg flex items-center justify-between text-xs text-danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ×
          </button>
        </div>
      )}

      {/* Members Table Card */}
      <Card className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase text-muted-foreground">
                <th className="p-4 font-semibold">Member</th>
                <th className="p-4 font-semibold">Role</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Joined Date</th>
                <th className="p-4 font-semibold">Last Activity</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading organization members...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No members found in this workspace scope.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const isCurrentCaller = user ? m.userId === user.id : false;
                  return (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      {/* Name & Avatar */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              className="h-6 w-6 rounded-full border border-white/10"
                              alt="Avatar"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-accent text-[10px]">
                              {m.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-1.5">
                              {m.displayName}
                              {isCurrentCaller && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-white/10 text-muted-foreground rounded">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{m.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <RoleBadge role={m.role} size="sm" />
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                            m.status === 'ACTIVE'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : m.status === 'INVITED'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>

                      {/* Joined Date */}
                      <td className="p-4 text-muted-foreground">
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '--'}
                      </td>

                      {/* Last Activity (Truthful: renders "--" if unavailable) */}
                      <td className="p-4 text-muted-foreground">
                        {m.lastActiveAt ? new Date(m.lastActiveAt).toLocaleString() : '--'}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canChangeRole && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Change Role"
                              onClick={() => {
                                setRoleChangeTarget(m);
                                setNewSelectedRole(m.role);
                              }}
                              className="h-7 px-2 text-muted-foreground hover:text-foreground"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canRemove && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Remove Member"
                              onClick={() => setRemoveTarget(m)}
                              className="h-7 px-2 text-danger hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {!canChangeRole && !canRemove && (
                            <span className="text-[10px] text-muted-foreground">Read Only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="glass-panel max-w-md w-full border-border/40 p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-foreground">Invite Organization Member</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Collaborators will receive an email invitation to join this workspace.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleInvite} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="collaborator@enterprise.io"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Assigned Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as SculraRole)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {ALL_ROLES.filter((r) => {
                    // Only show roles caller is allowed to assign
                    if (currentUserRole !== 'OWNER' && r === 'OWNER') return false;
                    return ROLE_RANKS[r] <= ROLE_RANKS[currentUserRole];
                  }).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_METADATA[r].title} - {ROLE_METADATA[r].description.slice(0, 50)}...
                    </option>
                  ))}
                </select>
              </div>

              <Flex className="justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                  disabled={inviteSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={inviteSubmitting}>
                  {inviteSubmitting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </Flex>
            </form>
          </Card>
        </div>
      )}

      {/* Role Change Modal */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="glass-panel max-w-md w-full border-border/40 p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-foreground">Change Member Role</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Update access role for <span className="text-foreground font-semibold">{roleChangeTarget.displayName}</span>.
              </CardDescription>
            </CardHeader>

            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Select New Role</label>
                <select
                  value={newSelectedRole}
                  onChange={(e) => setNewSelectedRole(e.target.value as SculraRole)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {ALL_ROLES.filter((r) => {
                    if (currentUserRole !== 'OWNER' && r === 'OWNER') return false;
                    return ROLE_RANKS[r] <= ROLE_RANKS[currentUserRole];
                  }).map((r) => (
                    <option key={r} value={r}>
                      {ROLE_METADATA[r].title} ({ROLE_METADATA[r].description.slice(0, 45)}...)
                    </option>
                  ))}
                </select>
              </div>

              {roleChangeTarget.role === 'OWNER' && newSelectedRole !== 'OWNER' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-md text-[11px] text-amber-400">
                  Warning: Demoting an Owner requires that at least one other active Owner remains.
                </div>
              )}

              <Flex className="justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRoleChangeTarget(null)}
                  disabled={roleChangeSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleRoleChange}
                  disabled={roleChangeSubmitting || newSelectedRole === roleChangeTarget.role}
                >
                  {roleChangeSubmitting ? 'Updating...' : 'Confirm Role Change'}
                </Button>
              </Flex>
            </div>
          </Card>
        </div>
      )}

      {/* Remove Member Confirmation Modal */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="glass-panel max-w-md w-full border-danger/40 p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle className="text-base font-bold text-danger flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Remove Member
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Are you sure you want to remove <span className="text-foreground font-semibold">{removeTarget.displayName}</span> ({removeTarget.email}) from the workspace?
              </CardDescription>
            </CardHeader>

            <div className="p-3 bg-danger/10 border border-danger/20 rounded-md text-[11px] text-danger leading-relaxed">
              This action immediately revokes all project, campaign, and organization access for this user.
              {removeTarget.role === 'OWNER' && ' Sole organization owner cannot be removed.'}
            </div>

            <Flex className="justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRemoveTarget(null)}
                disabled={removeSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={removeSubmitting}
              >
                {removeSubmitting ? 'Removing...' : 'Remove Member'}
              </Button>
            </Flex>
          </Card>
        </div>
      )}
    </Stack>
  );
}
