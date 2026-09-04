'use client';

import * as React from 'react';
import Link from 'next/link';
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
    <section className="relative py-24 sm:py-32 overflow-hidden bg-zinc-950 text-white border-t border-zinc-900">
      {/* Subtle inverse dot-grid texture on dark surface */}
      <div 
        className="absolute inset-0 -z-10 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Soft blurred accent glow behind text */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-[450px] w-[600px] bg-cyan-500/15 rounded-full blur-[140px] pointer-events-none" 
      />
      
      <Container className="text-center max-w-4xl relative z-10">
        <div className="space-y-8">
          <Stack spacing={16}>
            <span className="inline-flex items-center self-center rounded-full bg-cyan-950 px-3.5 py-1 text-[11px] font-bold text-cyan-300 border border-cyan-800 uppercase tracking-widest font-mono shadow-xs">
              Continuous Testing Swarm
            </span>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight text-white max-w-2xl mx-auto">
              Ready to ship with 100% confidence?
            </h2>
            <p className="text-base sm:text-lg text-zinc-200 leading-relaxed max-w-xl mx-auto font-normal">
              Let Sculra test what your team doesn&apos;t have time to. Crawl layouts, catch visual differences, test mobile viewports, and verify release readiness autonomously.
            </p>
          </Stack>

          {/* Email waitlist mini-form */}
          <div className="max-w-md mx-auto pt-2">
            {submitted ? (
              <div className="text-xs text-cyan-300 font-semibold bg-cyan-950/60 p-3.5 border border-cyan-800 rounded-xl font-mono">
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
                  className="flex-grow px-4 py-2.5 text-xs rounded-xl bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 transition-colors text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Join Waitlist
                </button>
              </form>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link href="/sign-up" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-100 transition-all font-mono uppercase tracking-wider text-xs font-bold cursor-pointer shadow-md hover:scale-105 active:scale-95">
                Start Testing Free
              </button>
            </Link>
            <Link href="/docs" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800 transition-all font-mono uppercase tracking-wider text-xs font-semibold cursor-pointer">
                Explore Docs
              </button>
            </Link>
          </div>

          <div className="text-xs text-zinc-300 font-mono">
            No credit card required • Free forever plan • Cancel anytime
          </div>
        </div>
      </Container>
    </section>
  );
}
