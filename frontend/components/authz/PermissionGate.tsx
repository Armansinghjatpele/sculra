'use client';

import * as React from 'react';
import { useOrganization } from '@clerk/nextjs';
import { SculraRole, mapClerkRoleToSculra } from '../../lib/authz/roles';
import { SculraPermission } from '../../lib/authz/permissions';
import { hasPermission } from '../../lib/authz/role-permissions';

export interface PermissionGateProps {
  permission: SculraPermission;
  userRole?: SculraRole | string;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Conditionally renders child components if the active user possesses the required permission.
 * Reads userRole from props or defaults to the active Clerk organization membership role.
 */
export function PermissionGate({
  permission,
  userRole,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { membership } = useOrganization();

  const effectiveRole: SculraRole = React.useMemo(() => {
    if (userRole) {
      return (userRole.toUpperCase() as SculraRole) || 'VIEWER';
    }
    return mapClerkRoleToSculra(membership?.role);
  }, [userRole, membership?.role]);

  const allowed = hasPermission(effectiveRole, permission);

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
