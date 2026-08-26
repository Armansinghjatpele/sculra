'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '../Button';
import { Container, Stack } from '../LayoutPrimitives';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export function FinalCTA() {
  const [email, setEmail] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);
  const prefersReduced = usePrefersReducedMotion();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setEmail('');
    }
  };

  return (
    <section className="relative py-28 border-t border-white/5 overflow-hidden bg-zinc-950/20">
      {/* Accent glow circle */}
      <div 
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,rgba(0,212,255,0.08),rgba(139,92,246,0.08)_50%,transparent_70%)] animate-pulse" 
        style={prefersReduced ? {} : { animationDuration: '8s' }} 
      />
      
      <Container className="text-center max-w-3xl">
        <div className="border border-white/10 rounded-2xl bg-zinc-900/60 p-8 md:p-14 shadow-floating-card backdrop-blur-md space-y-8 border-gradient-hover">
          <Stack spacing={16}>
            <span className="inline-flex items-center self-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest font-mono">
              Continuous Testing Swarm
            </span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Ready to ship with 100% confidence?
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Let Sculra test what your team doesn&apos;t have time to. Crawl layouts, catch visual differences, test mobile viewports, and verify release readiness autonomously.
            </p>
          </Stack>

          {/* Email waitlist mini-form */}
          <div className="max-w-md mx-auto">
            {submitted ? (
              <div className="text-xs text-accent font-semibold bg-accent/5 p-3 border border-accent/20 rounded-lg font-mono">
                ✓ Thank you! You&apos;ve been added to the waitlist queue.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="Enter your email to join waitlist"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-grow px-4 py-2.5 text-xs rounded-md bg-zinc-950 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <Button type="submit" variant="accent" size="sm" className="whitespace-nowrap text-xs font-mono uppercase tracking-wider">
                  Join Waitlist
                </Button>
              </form>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6 border-t border-white/5">
            <Link href="/sign-up" className="w-full sm:w-auto">
              <Button variant="accent" size="lg" className="w-full font-mono uppercase tracking-wider text-xs">
                Start Testing Free
              </Button>
            </Link>
            <Link href="/docs" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full font-mono uppercase tracking-wider text-xs">
                Explore Docs
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
