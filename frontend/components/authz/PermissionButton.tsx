'use client';

import * as React from 'react';
import { useOrganization } from '@clerk/nextjs';
import { Button, ButtonProps } from '../Button';
import { SculraRole, mapClerkRoleToSculra } from '../../lib/authz/roles';
import { SculraPermission } from '../../lib/authz/permissions';
import { hasPermission } from '../../lib/authz/role-permissions';
import { cn } from '../../lib/utils';
import { Lock } from 'lucide-react';

export interface PermissionButtonProps extends ButtonProps {
  permission: SculraPermission;
  userRole?: SculraRole | string;
  mode?: 'disabled' | 'hidden';
  explanation?: string;
}

export function PermissionButton({
  permission,
  userRole,
  mode = 'disabled',
  explanation,
  disabled,
  children,
  className,
  ...props
}: PermissionButtonProps) {
  const { membership } = useOrganization();

  const effectiveRole: SculraRole = React.useMemo(() => {
    if (userRole) {
      return (userRole.toUpperCase() as SculraRole) || 'VIEWER';
    }
    return mapClerkRoleToSculra(membership?.role);
  }, [userRole, membership?.role]);

  const allowed = hasPermission(effectiveRole, permission);

  if (!allowed && mode === 'hidden') {
    return null;
  }

  const defaultExplanation = `Requires "${permission}" permission (current role: ${effectiveRole})`;
  const title = !allowed ? explanation || defaultExplanation : props.title;

  return (
    <div className="relative inline-block group">
      <Button
        {...props}
        disabled={disabled || !allowed}
        title={title}
        className={cn(
          className,
          !allowed && 'opacity-60 cursor-not-allowed hover:bg-transparent'
        )}
      >
        {!allowed && <Lock className="w-3 h-3 mr-1 text-muted-foreground inline" />}
        {children}
      </Button>

      {!allowed && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 whitespace-nowrap bg-zinc-900 border border-white/10 px-2 py-1 rounded text-[10px] text-zinc-300 shadow-xl pointer-events-none">
          {explanation || defaultExplanation}
        </div>
      )}
    </div>
  );
}
