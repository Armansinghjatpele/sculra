import * as React from 'react';
import Link from 'next/link';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card';

export function UnauthorizedState({ message }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="glass-panel max-w-md w-full text-center">
        <CardHeader className="space-y-2">
          <span className="text-2xs font-bold text-danger uppercase tracking-wider">401 Error</span>
          <CardTitle className="text-xl font-bold">Authentication Required</CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            {message || 'You must be signed in to view this dashboard page.'}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center border-t border-border/20 pt-4 gap-3">
          <Link href="/sign-in">
            <Button variant="accent" size="sm">Sign In</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm">Back to Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="glass-panel max-w-md w-full text-center">
        <CardHeader className="space-y-2">
          <span className="text-2xs font-bold text-warning uppercase tracking-wider">403 Forbidden</span>
          <CardTitle className="text-xl font-bold">Access Denied</CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            {message || 'Your account does not possess permissions to edit or view this workspace.'}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center border-t border-border/20 pt-4 gap-3">
          <Link href="/dashboard">
            <Button variant="accent" size="sm">Return to Dashboard</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="sm">Back to Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
