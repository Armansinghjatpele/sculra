'use client';

import * as React from 'react';
import { Crown, Shield, CheckCircle, Code, Eye } from 'lucide-react';
import { SculraRole } from '../../lib/authz/roles';
import { cn } from '../../lib/utils';

interface RoleBadgeProps {
  role: SculraRole | string;
  size?: 'sm' | 'md';
  className?: string;
}

export function RoleBadge({ role, size = 'sm', className }: RoleBadgeProps) {
  const normalized = (role?.toUpperCase() || 'VIEWER') as SculraRole;

  const config: Record<
    SculraRole,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    OWNER: {
      label: 'Owner',
      bg: 'bg-amber-500/15',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
      icon: <Crown className="w-3 h-3 text-amber-400" />,
    },
    ADMIN: {
      label: 'Admin',
      bg: 'bg-blue-500/15',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: <Shield className="w-3 h-3 text-blue-400" />,
    },
    QA_LEAD: {
      label: 'QA Lead',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: <CheckCircle className="w-3 h-3 text-emerald-400" />,
    },
    DEVELOPER: {
      label: 'Developer',
      bg: 'bg-cyan-500/15',
      text: 'text-cyan-400',
      border: 'border-cyan-500/30',
      icon: <Code className="w-3 h-3 text-cyan-400" />,
    },
    VIEWER: {
      label: 'Viewer',
      bg: 'bg-zinc-800/60',
      text: 'text-zinc-400',
      border: 'border-zinc-700/40',
      icon: <Eye className="w-3 h-3 text-zinc-400" />,
    },
  };

  const item = config[normalized] || config.VIEWER;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono font-bold uppercase rounded-md border tracking-wider select-none',
        item.bg,
        item.text,
        item.border,
        size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      {item.icon}
      {item.label}
    </span>
  );
}
