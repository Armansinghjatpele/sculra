import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './Card';
import { Badge } from './Badge';

export interface StatCardProps {
  label: string;
  value: string | number;
  changePercent?: number;
  timeframe?: string;
  className?: string;
}

export function StatCard({ label, value, changePercent, timeframe, className }: StatCardProps) {
  const isPositive = changePercent !== undefined && changePercent >= 0;

  return (
    <Card className={className}>
      <CardHeader className="pb-1.5 flex flex-row items-center justify-between space-y-0">
        <CardDescription className="text-4xs uppercase tracking-widest font-semibold">{label}</CardDescription>
        {changePercent !== undefined && (
          <Badge variant={isPositive ? 'success' : 'danger'} className="text-5xs px-1.5 py-0">
            {isPositive ? '+' : ''}{changePercent}%
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {timeframe && (
          <p className="text-4xs text-muted-foreground">{timeframe}</p>
        )}
      </CardContent>
    </Card>
  );
}
