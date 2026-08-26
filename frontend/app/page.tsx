'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Accordion, AccordionItem } from '@/components/Accordion';
import { Container, Section, Grid, Flex, Stack, Divider } from '@/components/LayoutPrimitives';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

// Landing Page Modular Visual Components
import { HeroTestingVisualization } from '@/components/landing/HeroTestingVisualization';
import { TestingJourney } from '@/components/landing/TestingJourney';
import { BrowserMockup } from '@/components/landing/BrowserMockup';
import { DevicePreview } from '@/components/landing/DevicePreview';
import { IssueDetection } from '@/components/landing/IssueDetection';
import { ReleaseScore } from '@/components/landing/ReleaseScore';
import { GitHubPipeline } from '@/components/landing/GitHubPipeline';
import { SystemArchitecture } from '@/components/landing/SystemArchitecture';
import { AIEngineerPanel } from '@/components/landing/AIEngineerPanel';
import { FinalCTA } from '@/components/landing/FinalCTA';

// Brand Logos Marquee
import { BrandLogosMarquee } from '@/components/landing/BrandLogos';

// Count-up helper component for stats animation
function StatCounter({ value, duration = 2, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [count, setCount] = React.useState(0);
  const elementRef = React.useRef<HTMLDivElement>(null);
  const prefersReduced = usePrefersReducedMotion();

  React.useEffect(() => {
    if (prefersReduced) {
      setCount(value);
      return;
    }
    let observer: IntersectionObserver;
    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          window.requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (elementRef.current) {
      observer.observe(elementRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [value, duration, prefersReduced]);

  return (
    <div ref={elementRef} className="text-xl sm:text-2xl font-extrabold text-foreground font-mono">
      {count.toLocaleString()}{suffix}
    </div>
  );
}

export default function Home() {
  const prefersReduced = usePrefersReducedMotion();
  const [waitlistEmail, setWaitlistEmail] = React.useState('');
  const [waitlistSubmitted, setWaitlistSubmitted] = React.useState(false);

  const handleWaitlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (waitlistEmail) {
      setWaitlistSubmitted(true);
      setWaitlistEmail('');
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08, delayChildren: 0.05 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: prefersReduced ? 0 : 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  // Scroll animations variants for alternating layout columns
  const slideLeftVariants: Variants = {
    hidden: { opacity: 0, x: prefersReduced ? 0 : -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const slideRightVariants: Variants = {
    hidden: { opacity: 0, x: prefersReduced ? 0 : 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const faqItems = [
    { title: 'How does Sculra discover website pages?', content: 'Sculra deploys an automated crawler that spider-crawls the DOM, discovering links, form inputs, button elements, and overlays without requiring manual routing maps.' },
    { title: 'Can I run Sculra inside our private VPC?', content: 'Yes, our Enterprise package supports deploying containerized, isolated QA runners within your private AWS/GCP networks.' },
    { title: 'How is sensitive credentials data secured?', content: 'All API keys, password configurations, and tokens are encrypted at rest using AES-256 standards, and database records isolation is enforced via Supabase RLS.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-hidden">
      <Navbar />

      <main className="flex-grow relative">
        {/* Layered background radial mesh glow coordinates */}
        <div className="absolute top-0 left-1/4 -z-10 h-[500px] w-[500px] bg-accent/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute top-[25%] right-1/4 -z-10 h-[600px] w-[600px] bg-accent-2/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[30%] left-1/3 -z-10 h-[550px] w-[550px] bg-accent/8 rounded-full blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[5%] right-1/4 -z-10 h-[600px] w-[600px] bg-accent-2/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Ambient Grid Background */}
        <div className="absolute inset-0 -z-20 bg-grid-ambient bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)]" />

        {/* HERO SECTION */}
        <Section className="relative pt-28 pb-20 sm:pt-36">
          <Container>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center max-w-4xl mx-auto space-y-6 mb-16"
            >
              <motion.span
                variants={itemVariants}
                className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest"
              >
                AI-Powered Quality Engineering
              </motion.span>
              
              <motion.h1
                variants={itemVariants}
                className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground leading-[1.1] select-none"
              >
                Your AI QA Engineer.
                <br />
                <span className="text-gradient font-black">Test everything. Autonomously.</span>
              </motion.h1>
              
              <motion.p
                variants={itemVariants}
                className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed"
              >
                Sculra crawls your application like a human QA engineer. Discover functional bugs, visual regressions, and responsive layout shifts with zero manual scripting required.
              </motion.p>

              <motion.div variants={itemVariants} className="pt-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-4">
                  <Link href="/sign-up">
                    <Button variant="accent" size="lg" className="hover:scale-105 transition-all">Start Testing Free</Button>
                  </Link>
                  <Link href="/docs">
                    <Button variant="outline" size="lg" className="hover:bg-white/5 transition-all">See How It Works</Button>
                  </Link>
                </div>
                {/* Risk-reversal microcopy */}
                <span className="text-5xs uppercase tracking-widest text-muted-foreground font-mono mt-1">
                  No credit card required • Free forever plan • Cancel anytime
                </span>
              </motion.div>
            </motion.div>

            {/* Simulated Live Testing Visual Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.7 }}
            >
              <HeroTestingVisualization />
            </motion.div>
          </Container>
        </Section>

        {/* LIVING STATS BAR UNDER HERO */}
        <section className="py-8 border-y border-white/5 bg-zinc-950/40 relative">
          <Container>
            <Grid cols={2} colsSm={4} gap={16} className="text-center">
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Pages Scanned</div>
                <StatCounter value={24930} />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Regressions Blocked</div>
                <StatCounter value={1498} />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Avg. Readiness Index</div>
                <StatCounter value={91} suffix=".4%" />
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono">Time to First Bug</div>
                <StatCounter value={34} suffix="s" />
              </div>
            </Grid>
          </Container>
        </section>

        {/* INFINITE BRAND MARQUEE SECTION */}
        <section className="py-6 bg-zinc-950/20 border-b border-white/5">
          <Container>
            <p className="text-center text-5xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 font-mono">
              Empowering active product developers worldwide
            </p>
            <BrandLogosMarquee />
          </Container>
        </section>

        {/* SECTION 2 - THE PROBLEM */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
              >
                <Stack spacing={24} className="justify-center text-left max-w-md">
                  <span className="text-xs font-bold text-danger uppercase tracking-wider font-mono">The Complexity Dilemma</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    A landscape too vast to test by hand.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Every user state, route branch, device model, and role variant creates a combinatoric explosion. Manual testing misses visual overflows and regression crashes on staging.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
              >
                <TestingJourney />
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 3 - HOW IT WORKS */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-zinc-950/30 border-y border-white/5 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="order-2 md:order-1"
              >
                <BrowserMockup />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="order-1 md:order-2"
              >
                <Stack spacing={24} className="justify-center text-left max-w-md ml-auto">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">How Sculra Works</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Reads your UI from the outside in.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sculra autonomously walks through forms, clicks interactable nodes, records traces, and checks DOM properties without any code integration required.
                  </p>
                </Stack>
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 4 - VISUAL QA */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
              >
                <Stack spacing={24} className="justify-center text-left max-w-md">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Pixel Verification</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Checks what your users actually see.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Catch overlapping margins, text collisions, font weight mismatches, and element overflows automatically before merging a pull request.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
              >
                <IssueDetection />
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 5 - RESPONSIVE TESTING */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-zinc-950/30 border-y border-white/5 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="order-2 md:order-1"
              >
                <DevicePreview />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="order-1 md:order-2"
              >
                <Stack spacing={24} className="justify-center text-left max-w-md ml-auto">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Device Matrix</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Verify layouts on every viewport.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Test your interface simultaneously across mobile, tablet, and widescreen frames, highlighting layout shifts that break specific breakpoints.
                  </p>
                </Stack>
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 6 - THE AI QA MEMBER */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
              >
                <Stack spacing={24} className="justify-center text-left max-w-md">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Autonomous Reasoning</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Reasoning logs that trace every flaw.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sculra checks browser console dumps, network responses, and API payloads to reproduce the exact steps that caused a page validation crash.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
              >
                <AIEngineerPanel />
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 7 - RELEASE READINESS SCORECARD */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-zinc-950/30 border-y border-white/5 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="order-2 md:order-1"
              >
                <ReleaseScore />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="order-1 md:order-2"
              >
                <Stack spacing={24} className="justify-center text-left max-w-md ml-auto">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Readiness Check</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Never guess if a build is safe to deploy.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Our release scorecard assigns a comprehensive index from 0 to 100 representing DOM stability, speed tolerances, accessibility compliance, and visual fit.
                  </p>
                </Stack>
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 8 - CI PIPELINE STATUS */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
              >
                <Stack spacing={24} className="justify-center text-left max-w-md">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">CI Integrations</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Intercept bugs before they merge.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Block PR merges automatically if a code push drops your app readiness index. Sculra comments results directly inside your code branch logs.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
              >
                <GitHubPipeline />
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 9 - MULTI-SOURCE DIAGRAM */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-zinc-950/30 border-y border-white/5 relative overflow-hidden">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="order-2 md:order-1"
              >
                <SystemArchitecture />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="order-1 md:order-2"
              >
                <Stack spacing={24} className="justify-center text-left max-w-md ml-auto">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Multi-Source Ingestion</span>
                  <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                    Any source format, ingested.
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Whether you test dynamic URLs, synced repositories, ZIP folders, or desktop executable binaries, our ingestion engine handles them cleanly.
                  </p>
                </Stack>
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* MANUAL QA VS SCULRA COMPARISON TABLE */}
        <Section className="py-24 relative overflow-hidden">
          <Container className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-12 space-y-3"
            >
              <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Evaluation Matrix</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Manual QA vs Sculra</h2>
              <p className="text-sm text-muted-foreground">See how autonomous quality sweeps compare to standard testing cycles.</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              className="overflow-x-auto border border-white/10 rounded-xl bg-zinc-900/60 shadow-glass border-gradient-hover"
            >
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase text-muted-foreground">
                    <th className="p-4">Dimension</th>
                    <th className="p-4">Manual / Scripted QA</th>
                    <th className="p-4 text-accent">Sculra Autonomous QA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-foreground">Coverage Area</td>
                    <td className="p-4 text-muted-foreground">Manual check of major routes</td>
                    <td className="p-4 text-accent font-semibold">Autonomous 100% path coverage</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-foreground">Execution Speed</td>
                    <td className="p-4 text-muted-foreground">Hours to days per cycle</td>
                    <td className="p-4 text-accent font-semibold">Minutes per build run</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-foreground">Setup Overhead</td>
                    <td className="p-4 text-muted-foreground">Continuous selector script updates</td>
                    <td className="p-4 text-accent font-semibold">Zero-script instant source sync</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-foreground">Consistency</td>
                    <td className="p-4 text-muted-foreground">Flaky test selector failures</td>
                    <td className="p-4 text-accent font-semibold">Adaptive DOM-aware updates</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-foreground">Availability</td>
                    <td className="p-4 text-muted-foreground">Scheduled developer bandwidth</td>
                    <td className="p-4 text-accent font-semibold">24/7 continuous triggers</td>
                  </tr>
                </tbody>
              </table>
            </motion.div>
          </Container>
        </Section>

        {/* SECURITY & TRUST SECTION */}
        <Section className="py-20 bg-zinc-950/30 border-y border-white/5 relative overflow-hidden">
          <Container>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-12 space-y-3"
            >
              <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Tenant Boundaries</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Compact & Enforced Security</h2>
              <p className="text-sm text-muted-foreground">Sculra leverages standard protocols to isolate code data and keys.</p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto font-mono text-[10px] leading-relaxed">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="p-5 border border-white/10 bg-zinc-900/60 rounded-xl space-y-3 shadow-glass border-gradient-hover"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="text-accent font-bold uppercase">Clerk Authentication</span>
                </div>
                <p className="text-muted-foreground">Secure identities authentication and credentials handled by Clerk OAuth.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="p-5 border border-white/10 bg-zinc-900/60 rounded-xl space-y-3 shadow-glass border-gradient-hover"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-accent font-bold uppercase">Supabase RLS Isolation</span>
                </div>
                <p className="text-muted-foreground">Strict multi-tenant security separation verified at database query layer using Supabase RLS.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="p-5 border border-white/10 bg-zinc-900/60 rounded-xl space-y-3 shadow-glass border-gradient-hover"
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <span className="text-accent font-bold uppercase">Sentry Diagnostics</span>
                </div>
                <p className="text-muted-foreground">Continuous diagnostics monitoring and bug trace audits powered by Sentry and PostHog.</p>
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SOCIAL PROOF / TESTIMONIALS STRIP */}
        <Section className="py-20 relative overflow-hidden">
          <Container className="max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-12 space-y-3"
            >
              <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Social Proof</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Built for teams that ship.</h2>
              <p className="text-sm text-muted-foreground">Here is what active engineering leaders say about using Sculra.</p>
            </motion.div>
            
            <Grid cols={1} colsMd={3} gap={20}>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="transition-all duration-300"
              >
                <Card className="glass-panel p-5 space-y-3 bg-zinc-900/60 border border-white/10 rounded-xl border-gradient-hover shadow-glass h-full">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    &quot;Sculra blocked a critical payment flow overflow regression in our staging build before we pushed it live. It&apos;s like having an extra QA engineer on every PR.&quot;
                  </p>
                  <div className="pt-2 border-t border-white/5 font-mono text-[9px]">
                    <span className="text-foreground font-semibold block">[PLACEHOLDER — User Name 1]</span>
                    <span className="text-muted-foreground">[PLACEHOLDER — Role 1, Company 1]</span>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="transition-all duration-300"
              >
                <Card className="glass-panel p-5 space-y-3 bg-zinc-900/60 border border-white/10 rounded-xl border-gradient-hover shadow-glass h-full">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    &quot;Writing browser checks used to be an endless chore of updating selectors. Sculra spider-crawls autonomously and adapts to our DOM tweaks.&quot;
                  </p>
                  <div className="pt-2 border-t border-white/5 font-mono text-[9px]">
                    <span className="text-foreground font-semibold block">[PLACEHOLDER — User Name 2]</span>
                    <span className="text-muted-foreground">[PLACEHOLDER — Role 2, Company 2]</span>
                  </div>
                </Card>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="transition-all duration-300"
              >
                <Card className="glass-panel p-5 space-y-3 bg-zinc-900/60 border border-white/10 rounded-xl border-gradient-hover shadow-glass h-full">
                  <p className="text-xs text-muted-foreground italic leading-relaxed">
                    &quot;We synced our codebase in under 2 minutes. The release readiness score is now our single source of truth before merge approvals.&quot;
                  </p>
                  <div className="pt-2 border-t border-white/5 font-mono text-[9px]">
                    <span className="text-foreground font-semibold block">[PLACEHOLDER — User Name 3]</span>
                    <span className="text-muted-foreground">[PLACEHOLDER — Role 3, Company 3]</span>
                  </div>
                </Card>
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* PRICING PREVIEW */}
        <Section className="py-24 bg-zinc-950/30 border-t border-white/5 relative overflow-hidden">
          <Container>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center max-w-2xl mx-auto mb-16 space-y-4"
            >
              <span className="text-xs font-bold text-accent uppercase tracking-wider font-mono">Simple Pricing</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Based on how much you test.</h2>
              <p className="text-sm text-muted-foreground">Start testing free, then scale up as your deployment quotas expand.</p>
            </motion.div>

            <Grid cols={1} colsMd={3} gap={24} className="max-w-4xl mx-auto">
              {/* Free Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="h-full"
              >
                <Card className="glass-panel flex flex-col justify-between p-6 bg-zinc-900/60 border border-white/10 rounded-xl border-gradient-hover shadow-glass h-full">
                  <CardHeader className="p-0 pb-4">
                    <span className="text-xs font-bold text-foreground font-mono">Free Plan</span>
                    <div className="text-2xl font-bold text-foreground mt-2 font-mono">$0</div>
                    <CardDescription className="text-4xs text-muted-foreground mt-1">For exploring Sculra features</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 py-4 border-t border-b border-white/5 my-4">
                    <ul className="space-y-2 text-4xs text-muted-foreground font-mono">
                      <li>✓ 1 Target Project limit</li>
                      <li>✓ 10 Test runs per month</li>
                      <li>✓ Standard trace logs</li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-0">
                    <Link href="/sign-up" className="w-full">
                      <Button variant="outline" className="w-full text-4xs uppercase tracking-wider">Explore Free</Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>

              {/* Pro Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="h-full"
              >
                <Card className="glass-panel border-accent/40 shadow-glass flex flex-col justify-between p-6 bg-zinc-900/60 rounded-xl border-gradient-hover h-full">
                  <CardHeader className="p-0 pb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-foreground font-mono">Pro Plan</span>
                      <Badge variant="accent" className="text-5xs uppercase tracking-wider px-1.5 py-0">Popular</Badge>
                    </div>
                    <div className="text-2xl font-bold text-foreground mt-2 font-mono">$49</div>
                    <CardDescription className="text-4xs text-muted-foreground mt-1">For serious development teams</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 py-4 border-t border-b border-white/5 my-4">
                    <ul className="space-y-2 text-4xs text-muted-foreground font-mono">
                      <li>✓ 3 Target Projects limit</li>
                      <li>✓ 100 Test runs per month</li>
                      <li>✓ Visual alignment checks</li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-0">
                    <Link href="/sign-up" className="w-full">
                      <Button variant="accent" className="w-full text-4xs uppercase tracking-wider">Start Trial</Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>

              {/* Team Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="h-full"
              >
                <Card className="glass-panel flex flex-col justify-between p-6 bg-zinc-900/60 border border-white/10 rounded-xl border-gradient-hover shadow-glass h-full">
                  <CardHeader className="p-0 pb-4">
                    <span className="text-xs font-bold text-foreground font-mono">Team Plan</span>
                    <div className="text-2xl font-bold text-foreground mt-2 font-mono">$199</div>
                    <CardDescription className="text-4xs text-muted-foreground mt-1">For teams shipping continuously</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 py-4 border-t border-b border-white/5 my-4">
                    <ul className="space-y-2 text-4xs text-muted-foreground font-mono">
                      <li>✓ 10 Target Projects limit</li>
                      <li>✓ 1,000 Test runs per month</li>
                      <li>✓ Security & WCAG checks</li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-0">
                    <Link href="/sign-up" className="w-full">
                      <Button variant="outline" className="w-full text-4xs uppercase tracking-wider">Upgrade Team</Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            </Grid>
            
            <div className="text-center mt-10">
              <Link href="/pricing" className="text-xs text-accent hover:underline font-semibold font-mono">
                View all pricing plans & add-ons →
              </Link>
            </div>
          </Container>
        </Section>

        {/* WAITLIST REGISTRATION MINI-FORM */}
        <Section className="py-16 relative overflow-hidden">
          <Container className="max-w-md text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="space-y-2"
            >
              <h3 className="text-lg font-bold text-foreground">Get early updates on beta runs</h3>
              <p className="text-xs text-muted-foreground">Subscribe to receive technical guides and release previews.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
            >
              {waitlistSubmitted ? (
                <div className="text-xs text-accent font-semibold bg-accent/5 p-3 border border-accent/20 rounded-lg font-mono">
                  ✓ You&apos;ve successfully subscribed to Sculra news!
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Enter email to subscribe"
                    required
                    value={waitlistEmail}
                    onChange={(e) => setWaitlistEmail(e.target.value)}
                    className="flex-grow px-3 py-2 text-xs rounded bg-zinc-900 border border-white/10 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <Button type="submit" variant="accent" size="sm">
                    Subscribe
                  </Button>
                </form>
              )}
            </motion.div>
          </Container>
        </Section>

        {/* SECTION 16 - DRAMATIC FINAL CTA */}
        <FinalCTA />

        {/* FAQ ACCORDION SECTION */}
        <Section className="py-20 border-t border-white/5 relative overflow-hidden">
          <Container className="max-w-2xl">
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-3xl font-extrabold tracking-tight text-center mb-12"
            >
              Frequently Asked Questions
            </motion.h2>
            <Accordion>
              {faqItems.map((faq, idx) => (
                <AccordionItem key={idx} title={faq.title}>
                  <p className="text-xs leading-relaxed text-muted-foreground">{faq.content}</p>
                </AccordionItem>
              ))}
            </Accordion>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
