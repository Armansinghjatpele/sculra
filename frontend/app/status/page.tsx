import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Stack, Grid } from '@/components/LayoutPrimitives';
import { StatusCardWidget } from '@/components/DashboardWidgets';

export const metadata: Metadata = {
  title: 'System Uptime Status - Sculra',
  description: 'Uptime checks for Sculra API systems, testing runner clusters, and databases.',
};

export default function StatusPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-20">
          <Container className="max-w-2xl">
            <Stack spacing={32}>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">System Status</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Realtime uptime monitors for our dashboard operations and test execution grids.
                </p>
              </div>

              <Grid cols={1} gap={16}>
                <StatusCardWidget title="Express API Server" status="operational" />
                <StatusCardWidget title="Playwright Browser Runner Cluster" status="operational" />
                <StatusCardWidget title="Supabase DB & Storage Buckets" status="operational" />
                <StatusCardWidget title="AI Agents Inference API Pipeline" status="operational" />
              </Grid>
            </Stack>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
