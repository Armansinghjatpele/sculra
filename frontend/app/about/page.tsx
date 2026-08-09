import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export const metadata: Metadata = {
  title: 'About - Sculra',
  description: 'Our mission is to help software teams confidently ship zero-bug code using autonomous quality engineering.',
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-20">
          <Container className="max-w-3xl">
            <Stack spacing={32}>
              <div className="space-y-4">
                <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest">
                  Our Mission
                </span>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                  Confidence in every release.
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  We believe that software engineering should be fast, transparent, and completely under control. Sculra was founded to eliminate manual clicking routines by introducing autonomous QA agents that work like experienced developers.
                </p>
              </div>

              <Card className="glass-panel">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Continuous Improvement</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    By saving test trace history and analyzing regression loops, Sculra helps organizations predict failure points before they impact active production nodes.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Stack>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
