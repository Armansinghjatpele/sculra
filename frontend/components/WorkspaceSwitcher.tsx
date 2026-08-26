'use client';

import * as React from 'react';
import { OrganizationSwitcher, useOrganization, useUser } from '@clerk/nextjs';

export function WorkspaceSwitcher() {
  const { organization } = useOrganization();
  const { user } = useUser();

  return (
    <div className="flex items-center space-x-2 w-full px-2 py-1 bg-zinc-900/40 border border-white/5 rounded-md backdrop-blur-sm">
      <OrganizationSwitcher
        afterCreateOrganizationUrl="/dashboard"
        afterLeaveOrganizationUrl="/"
        afterSelectOrganizationUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'w-full text-foreground bg-transparent',
            organizationSwitcherTrigger: 'flex items-center justify-between w-full hover:bg-white/5 py-1 px-1.5 rounded transition-all text-xs font-semibold text-foreground',
            organizationSwitcherTriggerIcon: 'text-muted-foreground ml-2',
            organizationPreview: 'flex items-center text-foreground',
            organizationPreviewTextContainer: 'flex flex-col text-left text-xs text-foreground',
            organizationPreviewTitle: 'font-semibold text-foreground',
            organizationPreviewSubtitle: 'text-3xs text-muted-foreground',
            userButtonBox: 'hidden',
          }
        }}
      />
      {!organization && user && (
        <span className="sr-only">
          Personal Workspace: {user.fullName}
        </span>
      )}
    </div>
  );
}
