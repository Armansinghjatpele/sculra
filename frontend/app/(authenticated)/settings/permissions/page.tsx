'use client';

import * as React from 'react';
import { Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { RoleBadge } from '@/components/authz/RoleBadge';
import { Button } from '@/components/Button';
import { ALL_ROLES, ROLE_METADATA, SculraRole } from '@/lib/authz/roles';
import { PERMISSION_CATEGORIES } from '@/lib/authz/permissions';
import { ROLE_PERMISSIONS } from '@/lib/authz/role-permissions';
import { Check, X, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function PermissionExplorerPage() {
  const [selectedRoleFilter, setSelectedRoleFilter] = React.useState<SculraRole | 'ALL'>('ALL');

  return (
    <Stack spacing={24}>
      {/* Header */}
      <Flex className="justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/settings/team">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Team
              </Button>
            </Link>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            Enterprise Permission Explorer
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Authoritative role-to-permission mapping matrix governing workspace operations, safety gates, and approvals.
          </p>
        </div>

        {/* Filter by Role */}
        <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 rounded-lg p-1">
          <button
            onClick={() => setSelectedRoleFilter('ALL')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              selectedRoleFilter === 'ALL'
                ? 'bg-accent text-accent-foreground shadow'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Roles
          </button>
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRoleFilter(role)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                selectedRoleFilter === role
                  ? 'bg-accent text-accent-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {ROLE_METADATA[role].title}
            </button>
          ))}
        </div>
      </Flex>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {ALL_ROLES.map((role) => {
          const meta = ROLE_METADATA[role];
          const permCount = ROLE_PERMISSIONS[role].size;
          return (
            <Card
              key={role}
              className={`glass-panel p-3.5 space-y-2 cursor-pointer transition-all ${
                selectedRoleFilter === role ? 'ring-2 ring-accent bg-white/5' : ''
              }`}
              onClick={() => setSelectedRoleFilter(role === selectedRoleFilter ? 'ALL' : role)}
            >
              <div className="flex items-center justify-between">
                <RoleBadge role={role} size="sm" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {permCount} perms
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                {meta.description}
              </p>
            </Card>
          );
        })}
      </div>

      {/* Permission Categories & Matrix */}
      <Stack spacing={16}>
        {PERMISSION_CATEGORIES.map((category) => {
          return (
            <Card key={category.id} className="glass-panel overflow-hidden">
              <CardHeader className="p-4 bg-white/5 border-b border-white/5">
                <CardTitle className="text-xs font-bold text-foreground">
                  {category.name}
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground">
                  {category.description}
                </CardDescription>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-zinc-950/40 text-[9px] uppercase text-muted-foreground">
                      <th className="p-3 font-semibold w-1/3">Permission Key</th>
                      {ALL_ROLES.filter(
                        (r) => selectedRoleFilter === 'ALL' || selectedRoleFilter === r
                      ).map((role) => (
                        <th key={role} className="p-3 font-semibold text-center">
                          {ROLE_METADATA[role].title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[11px]">
                    {category.permissions.map((perm) => (
                      <tr key={perm.key} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground font-semibold font-mono text-[11px]">
                              {perm.key}
                            </span>
                            {perm.isSensitive && (
                              <span className="px-1.5 py-0.2 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[8px] font-bold rounded uppercase">
                                Sensitive
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-sans mt-0.5">
                            {perm.description}
                          </div>
                        </td>

                        {ALL_ROLES.filter(
                          (r) => selectedRoleFilter === 'ALL' || selectedRoleFilter === r
                        ).map((role) => {
                          const hasPerm = ROLE_PERMISSIONS[role].has(perm.key);
                          return (
                            <td key={role} className="p-3 text-center">
                              {hasPerm ? (
                                <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 mx-auto">
                                  <Check className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800/60 text-zinc-600 mx-auto">
                                  <X className="w-3 h-3" />
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </Stack>
    </Stack>
  );
}
