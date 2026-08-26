import * as React from 'react';
import { Grid, Stack, Flex } from '@/components/LayoutPrimitives';
import { Card, CardContent } from '@/components/Card';

export default function DashboardLoading() {
  return (
    <Stack spacing={24} className="animate-pulse">
      {/* Welcome Section Skeleton */}
      <Flex justify="between" align="center" wrap={true} className="gap-4">
        <div className="space-y-2">
          <div className="h-8 w-64 bg-zinc-800 rounded" />
          <div className="h-4 w-96 bg-zinc-800/60 rounded" />
        </div>
        <div className="h-9 w-28 bg-zinc-800 rounded" />
      </Flex>

      {/* 1. Scorecards Grid Skeletons */}
      <Grid cols={1} colsMd={3} gap={16}>
        <Card className="glass-panel w-full h-36 bg-zinc-900/40 border border-white/5 flex flex-col justify-between p-6">
          <div className="h-3 w-28 bg-zinc-800 rounded" />
          <div className="h-10 w-20 bg-zinc-800 rounded mt-2" />
          <div className="h-2 w-full bg-zinc-800/50 rounded mt-4" />
        </Card>
        <Card className="glass-panel w-full h-36 bg-zinc-900/40 border border-white/5 flex flex-col justify-between p-6">
          <div className="h-3 w-32 bg-zinc-800 rounded" />
          <div className="h-10 w-24 bg-zinc-800 rounded mt-2" />
          <div className="h-2 w-full bg-zinc-800/50 rounded mt-4" />
        </Card>
        <Card className="glass-panel w-full h-36 bg-zinc-900/40 border border-white/5 flex flex-col justify-between p-6">
          <div className="h-3 w-40 bg-zinc-800 rounded" />
          <div className="h-12 w-full bg-zinc-800/50 rounded mt-4" />
        </Card>
      </Grid>

      {/* 2. Numeric Statistics Summary Skeletons */}
      <Grid cols={1} colsSm={2} colsLg={4} gap={16}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="glass-panel h-24 bg-zinc-900/20 border border-white/5 p-4 flex flex-col justify-between">
            <div className="h-2 w-24 bg-zinc-800 rounded" />
            <div className="h-6 w-12 bg-zinc-800 rounded mt-2" />
            <div className="h-2 w-32 bg-zinc-800/40 rounded mt-2" />
          </Card>
        ))}
      </Grid>

      {/* 3. Test Activity Bar Chart Skeleton */}
      <Card className="glass-panel w-full h-56 bg-zinc-900/30 border border-white/5 p-6 flex flex-col justify-between">
        <div className="space-y-2">
          <div className="h-3.5 w-32 bg-zinc-800 rounded" />
          <div className="h-2.5 w-48 bg-zinc-800/60 rounded" />
        </div>
        <div className="h-32 w-full bg-zinc-800/35 rounded mt-4" />
      </Card>

      {/* 4. Lists Grid Skeletons */}
      <Grid cols={1} colsLg={3} gap={24}>
        <div className="lg:col-span-2 space-y-4">
          <div className="h-4 w-36 bg-zinc-800 rounded" />
          <div className="h-48 w-full bg-zinc-900/20 border border-white/5 rounded-xl" />
        </div>
        <div className="space-y-4">
          <div className="h-4 w-36 bg-zinc-800 rounded" />
          <div className="h-48 w-full bg-zinc-900/20 border border-white/5 rounded-xl" />
        </div>
      </Grid>
    </Stack>
  );
}
