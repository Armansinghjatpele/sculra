import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Grid, Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export const metadata: Metadata = {
  title: 'Documentation - Sculra',
  description: 'Quick start guides for integrating automated testing webhooks inside GitHub Actions or custom CI channels.',
};

export default function DocsPage() {
  const sections = [
    { title: 'Quick Start', desc: 'Deploy your first crawling sweep in under 5 minutes.' },
    { title: 'API Integration', desc: 'Execute programmatic triggers using API tokens and fetch test runs payload.' },
    { title: 'GitHub Actions', desc: 'Set up commit checking hooks to block buggy code pull requests.' },
    { title: 'Visual Diffs', desc: 'Configure screenshot thresholds to detect UI alignment bugs.' },
    { title: 'Security Scans', desc: 'Analyze cookies, CORS permissions, and SSL compliance settings.' },
    { title: 'Agent Profiles', desc: 'Instruct specialized AI PM or Tester agents to verify complex forms.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-16">
          <Container>
            <Stack spacing={16} className="mb-12">
              <h1 className="text-3xl font-extrabold tracking-tight">Sculra Documentation</h1>
              <p className="text-sm text-muted-foreground max-w-2xl leading-normal">
                Everything you need to configure and scale automated QA verification grids. Explore guides on API setups, crawler parameters, and custom AI actions.
              </p>
            </Stack>

            <Grid cols={1} colsSm={2} colsLg={3} gap={20}>
              {sections.map((item, idx) => (
                <Card key={idx} className="glass-panel glass-interactive">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">{item.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {item.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </Grid>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
