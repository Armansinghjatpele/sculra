import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';

export default function DashboardProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">Manage your targets and testing keys.</p>
        </div>
        <Link href="/dashboard/projects/create">
          <Button variant="accent">Create Project</Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>My App Core</CardTitle>
            <CardDescription>https://myapp.com</CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-xs text-muted-foreground">Connected to GitHub - branch: main</span>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
