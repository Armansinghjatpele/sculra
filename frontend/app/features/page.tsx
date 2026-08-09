import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Grid, Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import { Badge } from '@/components/Badge';

export const metadata: Metadata = {
  title: 'Features - Sculra AI QA Engineer',
  description: 'Explore autonomous test runs, accessibility audits, security sweeps, and release safety scoring.',
};

export default function FeaturesPage() {
  const featureList = [
    { title: 'Website Crawling', desc: 'Spider crawlers auto-discover DOM inputs, button states, and routes hierarchy.', badge: 'AI-Native' },
    { title: 'GitHub PR Automated QA', desc: 'Runs synthetic workflows and visual diffs on branch commits before merge.', badge: 'CI Integration' },
    { title: 'ZIP Project Scans', desc: 'Upload build bundles to inspect packaging weights, assets compression, and load speeds.', badge: 'Local Upload' },
    { title: 'Desktop App testing', desc: 'Simulates keyboard clicks and captures logs on Windows, Mac, and Linux executables.', badge: 'Beta' },
    { title: 'Accessibility Checks', desc: 'Ensures WCAG AA compliance, ARIA tag presence, and contrast balances.', badge: 'Compliance' },
    { title: 'Security Vulnerabilities Scans', desc: 'Intercepts SSL protocols, HTTP response headers, and cookies configurations.', badge: 'Security' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-20">
          <Container>
            <Stack spacing={32} className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center self-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest">
                Platform Overview
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Autonomously QA your application inside and out.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Sculra deploys a swarm of specialized AI agents that navigate workflows, test forms, audit code, and capture trace media.
              </p>
            </Stack>

            <Grid cols={1} colsSm={2} colsLg={3} gap={24}>
              {featureList.map((item, idx) => (
                <Card key={idx} className="glass-panel glass-interactive">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <Badge variant="accent" className="text-4xs uppercase tracking-wider py-0 px-2">
                        {item.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold">{item.title}</CardTitle>
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
