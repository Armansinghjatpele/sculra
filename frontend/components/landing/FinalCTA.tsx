'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '../Button';
import { Container, Stack } from '../LayoutPrimitives';

export function FinalCTA() {
  return (
    <section className="relative py-24 bg-card/15 border-t border-border overflow-hidden">
      {/* Accent glow circle */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,rgba(0,212,255,0.06),transparent_60%)] animate-pulse" style={{ animationDuration: '6s' }} />
      
      <Container className="text-center max-w-xl">
        <Stack spacing={24}>
          <span className="inline-flex items-center self-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest">
            Continuous Testing
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight">Ship with confidence.</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Let Sculra test what your team doesn't have time to. Crawl layouts, catch visual differences, test mobile frames, and ensure release readiness autonomously.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/sign-up">
              <Button variant="accent" size="lg">Start Testing Free</Button>
            </Link>
            <Link href="/docs">
              <Button variant="outline" size="lg">Explore Sculra</Button>
            </Link>
          </div>
        </Stack>
      </Container>
    </section>
  );
}
