'use client';

import * as React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../Card';
import { Button } from '../Button';
import { SculraPermission } from '../../lib/authz/permissions';
import { SculraRole } from '../../lib/authz/roles';
import { useRouter } from 'next/navigation';

export interface AccessDeniedProps {
  title?: string;
  message?: string;
  requiredPermission?: SculraPermission;
  userRole?: SculraRole | string;
}

export function AccessDenied({
  title = 'Access Restricted',
  message,
  requiredPermission,
  userRole,
}: AccessDeniedProps) {
  const router = useRouter();

  const defaultMessage = userRole && requiredPermission
    ? `Your current role (${userRole}) does not have the required "${requiredPermission}" permission to access this resource or perform this action.`
    : 'You do not have sufficient privileges to access this resource.';

  return (
    <div className="flex items-center justify-center p-8 min-h-[400px]">
      <Card className="glass-panel max-w-md w-full border-danger/30 text-center p-6 space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-danger/10 border border-danger/30 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6 text-danger" />
        </div>

        <CardHeader className="p-0">
          <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {message || defaultMessage}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 pt-2 flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="w-full inline-flex items-center justify-center gap-2 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
