import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card';
import { Badge } from './Badge';
import { Progress } from './Progress';
import { cn } from '@/lib/utils';

// ------------------------------------------------------------------------------
// 1. Statistics Widget
// ------------------------------------------------------------------------------
export interface StatItem {
  label: string;
  value: string | number;
  changePercent?: number; // e.g. +12 or -5
  timeframe?: string;
}

export function StatisticsWidget({ items }: { items: StatItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
      {items.map((item, idx) => (
        <Card key={idx} className="glass-panel">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider">
              {item.label}
            </CardTitle>
            {item.changePercent !== undefined && (
              <Badge variant={item.changePercent >= 0 ? 'success' : 'danger'} className="text-3xs py-0 px-1">
                {item.changePercent >= 0 ? `+${item.changePercent}%` : `${item.changePercent}%`}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{item.value}</div>
            {item.timeframe && (
              <p className="text-4xs text-muted-foreground mt-1">{item.timeframe}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------------------
// 2. AI Insights Widget
// ------------------------------------------------------------------------------
export interface InsightItem {
  id: string;
  agent: string;
  finding: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function AIInsightsWidget({ insights }: { insights: InsightItem[] }) {
  const badgeVariants = {
    low: 'secondary',
    medium: 'warning',
    high: 'danger',
    critical: 'danger',
  } as const;

  return (
    <Card className="glass-panel w-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
          AI Diagnostics & Insights
        </CardTitle>
        <CardDescription>Realtime reasoning logs from specialized QA agents.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((item) => (
          <div key={item.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-2.5 mb-1.5">
              <span className="text-xs font-semibold text-foreground uppercase tracking-widest">
                {item.agent}
              </span>
              <Badge variant={badgeVariants[item.severity] as any} className="text-4xs uppercase py-0 px-1.5">
                {item.severity}
              </Badge>
            </div>
            <p className="text-xs font-medium text-foreground">{item.finding}</p>
            <p className="text-3xs text-muted-foreground mt-1 bg-muted/40 p-2 rounded border border-border/30">
              💡 <span className="font-semibold text-foreground">Recommendation:</span> {item.recommendation}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------
// 3. Release Score Widget
// ------------------------------------------------------------------------------
export function ReleaseScoreWidget({
  score,
  label = 'Overall Stability',
}: {
  score: number;
  label?: string;
}) {
  let scoreColor = 'text-success';
  let badgeText = 'Excellent';
  let badgeVar: 'success' | 'warning' | 'danger' = 'success';

  if (score < 70) {
    scoreColor = 'text-danger';
    badgeText = 'Critical Failures';
    badgeVar = 'danger';
  } else if (score < 90) {
    scoreColor = 'text-warning';
    badgeText = 'Needs Review';
    badgeVar = 'warning';
  }

  return (
    <Card className="glass-panel w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-4xl font-extrabold tracking-tight', scoreColor)}>{score}%</span>
          <Badge variant={badgeVar} className="text-3xs py-0.5 px-2">
            {badgeText}
          </Badge>
        </div>
        <Progress value={score} />
        <p className="text-4xs text-muted-foreground leading-normal">
          This score represents visual alignments, API error rates, and security compliance levels.
        </p>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------
// 4. Bug Counter Widget
// ------------------------------------------------------------------------------
export interface BugCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function BugCounterWidget({ counts }: { counts: BugCounts }) {
  const total = counts.critical + counts.high + counts.medium + counts.low;

  return (
    <Card className="glass-panel w-full">
      <CardHeader>
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Open Vulnerabilities
        </CardTitle>
        <div className="text-2xl font-bold mt-1 text-foreground">
          {total} Active Issues
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
        <div className="rounded border border-danger/20 bg-danger/5 p-2">
          <div className="text-xs font-bold text-danger">{counts.critical}</div>
          <div className="text-4xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Critical</div>
        </div>
        <div className="rounded border border-danger/10 bg-danger/3 p-2">
          <div className="text-xs font-bold text-danger">{counts.high}</div>
          <div className="text-4xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">High</div>
        </div>
        <div className="rounded border border-warning/20 bg-warning/5 p-2">
          <div className="text-xs font-bold text-warning">{counts.medium}</div>
          <div className="text-4xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Medium</div>
        </div>
        <div className="rounded border border-border bg-muted/40 p-2">
          <div className="text-xs font-bold text-foreground">{counts.low}</div>
          <div className="text-4xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">Low</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------
// 5. Performance Card Widget
// ------------------------------------------------------------------------------
export interface PerformanceMetrics {
  loadTimeMs: number;
  domWeight: number;
  bundleSizeKb: number;
}

export function PerformanceCardWidget({ metrics }: { metrics: PerformanceMetrics }) {
  return (
    <Card className="glass-panel w-full">
      <CardHeader>
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Performance Budget
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs text-muted-foreground">Load Time</span>
          <span className="text-sm font-semibold text-foreground">{(metrics.loadTimeMs / 1000).toFixed(2)}s</span>
        </div>
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-xs text-muted-foreground">DOM Element Count</span>
          <span className="text-sm font-semibold text-foreground">{metrics.domWeight} nodes</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">JS Bundle Weight</span>
          <span className="text-sm font-semibold text-foreground">{metrics.bundleSizeKb} KB</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------------------------------------------------------------
// 6. Status Card Widget
// ------------------------------------------------------------------------------
export function StatusCardWidget({
  title,
  status,
}: {
  title: string;
  status: 'operational' | 'degraded' | 'failed';
}) {
  const statusConfig = {
    operational: { color: 'bg-success', label: 'Operational', var: 'success' as const },
    degraded: { color: 'bg-warning', label: 'Performance Degraded', var: 'warning' as const },
    failed: { color: 'bg-danger', label: 'System Outage', var: 'danger' as const },
  };

  const cfg = statusConfig[status];

  return (
    <Card className="glass-panel w-full">
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', cfg.color)} />
          <span className="text-xs font-semibold text-foreground">{title}</span>
        </div>
        <Badge variant={cfg.var} className="text-3xs uppercase py-0.5 px-2">
          {cfg.label}
        </Badge>
      </CardContent>
    </Card>
  );
}
