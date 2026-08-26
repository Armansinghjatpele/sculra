'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '../Button';
import { Container, Stack } from '../LayoutPrimitives';

export function FinalCTA() {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <section className="relative py-24 bg-card/15 border-t border-border overflow-hidden">
      {/* Accent glow circle */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,rgba(0,212,255,0.06),transparent_60%)] animate-pulse" style={{ animationDuration: '6s' }} />
      
      <Container className="text-center max-w-2xl">
        <div className="border border-white/10 rounded-2xl bg-zinc-950/40 p-8 md:p-12 shadow-floating-card backdrop-blur-md space-y-8">
          <Stack spacing={16}>
            <span className="inline-flex items-center self-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest">
              Continuous Testing
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Ship with confidence.</h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Let Sculra test what your team doesn't have time to. Crawl layouts, catch visual differences, test mobile frames, and ensure release readiness autonomously.
            </p>
          </Stack>

          {/* Email waitlist mini-form */}
          <div className="max-w-md mx-auto">
            {submitted ? (
              <div className="text-xs text-accent font-semibold bg-accent/5 p-3 border border-accent/20 rounded-lg">
                ✓ Thank you! You've been added to the waitlist queue.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="Enter your email to join waitlist"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-grow px-4 py-2 text-xs rounded-md bg-zinc-900 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button type="submit" variant="accent" size="sm" className="whitespace-nowrap text-xs">
                  Join Waitlist
                </Button>
              </form>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4 border-t border-white/5">
            <Link href="/sign-up" className="w-full sm:w-auto">
              <Button variant="accent" size="lg" className="w-full">Start Testing Free</Button>
            </Link>
            <Link href="/docs" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full">Explore Docs</Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
