import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Grid, Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';
import { Button } from '@/components/Button';

export const metadata: Metadata = {
  title: 'Enterprise QA Platform - Sculra',
  description: 'Self-hosted AI QA runner clusters, custom VPC database integration, SAML single-sign on, and SLA security metrics.',
};

export default function EnterprisePage() {
  const securityColumns = [
    { title: 'Isolated Runners', desc: 'Execute containerized Playwright sweeps inside your VPC networks.' },
    { title: 'SAML & SSO', desc: 'Sync users and organization members mapping with Okta, Azure AD, or Ping Identity.' },
    { title: 'Compliance & Audits', desc: 'Write-once immutable audit logs recording deployment checks, tokens rotation, and security triggers.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-20">
          <Container>
            <Stack spacing={32} className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center self-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest">
                Enterprise Scaling
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Deploy AI QA runners behind your firewall.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Sculra provides high-velocity, secure, and completely isolated verification environments designed to meet enterprise compliance standards.
              </p>
              <div className="mt-4 flex justify-center">
                <Link href="/contact">
                  <Button variant="accent" size="lg">Contact Enterprise Sales</Button>
                </Link>
              </div>
            </Stack>

            <Grid cols={1} colsMd={3} gap={24}>
              {securityColumns.map((item, idx) => (
                <Card key={idx} className="glass-panel">
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
