'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Chart } from '@/components/Chart';

export default function DashboardConsolePage() {
  const chartData = [
    { label: 'Mon', value: 88 },
    { label: 'Tue', value: 92 },
    { label: 'Wed', value: 90 },
    { label: 'Thu', value: 95 },
    { label: 'Fri', value: 98 },
    { label: 'Sat', value: 97 },
    { label: 'Sun', value: 100 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Console Overview</h1>
        <p className="text-sm text-muted-foreground">Monitor release safety and active test flows.</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Release Score</CardTitle>
            <Badge variant="success">98%</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">A+ Excellent</div>
            <p className="text-3xs text-muted-foreground mt-1">Uptime, performance and security checks passed.</p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Active Projects</CardTitle>
            <span className="text-xs text-muted-foreground">Total: 4</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">3 / 4 Configured</div>
            <p className="text-3xs text-muted-foreground mt-1">1 sandbox environment running.</p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Total Bugs</CardTitle>
            <Badge variant="danger">2 Open</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">0 Critical</div>
            <p className="text-3xs text-muted-foreground mt-1">2 warning items discovered in forms validation.</p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">Storage Space</CardTitle>
            <span className="text-xs text-muted-foreground">Limit: 10GB</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">1.4 GB Used</div>
            <p className="text-3xs text-muted-foreground mt-1">Mainly screenshots and HTML traces.</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass-panel">
          <CardHeader>
            <CardTitle>Stability History</CardTitle>
            <CardDescription>Average QA health trends across the active week.</CardDescription>
          </CardHeader>
          <CardContent>
            <Chart data={chartData} height={200} />
          </CardContent>
        </Card>

        <Card className="col-span-3 glass-panel">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Recent test-runs triggered in this organization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="success">Passed</Badge>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-medium text-foreground">run_main_branch_3</p>
                <p className="truncate text-3xs text-muted-foreground">My App Core - 10m ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="success">Passed</Badge>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-medium text-foreground">run_main_branch_2</p>
                <p className="truncate text-3xs text-muted-foreground">My App Core - 1h ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="warning">Warning</Badge>
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-xs font-medium text-foreground">sandbox_env_v1</p>
                <p className="truncate text-3xs text-muted-foreground">Admin Portal - 4h ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
