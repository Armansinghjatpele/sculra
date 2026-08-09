import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Grid, Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card';

export const metadata: Metadata = {
  title: 'Blog - Sculra',
  description: 'Release notes, quality metrics analytics, and AI agent testing research.',
};

export default function BlogPage() {
  const posts = [
    { title: 'Designing Sculra Brand Identity', date: 'August 7, 2026', desc: 'A deep dive into our geometric checkmark symbolism, dark-first color grids, and typing scales.' },
    { title: 'Visual Diffs Verification at Scale', date: 'July 24, 2026', desc: 'How we coordinate playwright screenshots comparison engines to reduce pixel noise.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-16">
          <Container>
            <Stack spacing={16} className="mb-12">
              <h1 className="text-3xl font-extrabold tracking-tight">Sculra Blog</h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Insights, stability tips, and release notes from the engineering team.
              </p>
            </Stack>

            <Grid cols={1} colsMd={2} gap={24}>
              {posts.map((post, idx) => (
                <Card key={idx} className="glass-panel glass-interactive">
                  <CardHeader>
                    <span className="text-4xs text-muted-foreground tracking-wider uppercase">{post.date}</span>
                    <CardTitle className="text-base font-semibold mt-2">{post.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {post.desc}
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
