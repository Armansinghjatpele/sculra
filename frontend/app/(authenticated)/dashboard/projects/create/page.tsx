import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Input } from '@/components/Input';

export default function DashboardCreateProjectPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Create Project</h1>
        <p className="text-sm text-muted-foreground">Add a new target application for automated QA scans.</p>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>Specify name and domain endpoints for testing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Project Name</label>
            <Input placeholder="e.g. Admin Dashboard Portal" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Target URL</label>
            <Input placeholder="e.g. https://staging.myapp.com" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Link href="/dashboard/projects">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button variant="accent">Save Project</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
