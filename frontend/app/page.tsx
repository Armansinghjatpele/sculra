'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Accordion, AccordionItem } from '@/components/Accordion';
import { Container, Section, Grid, Stack } from '@/components/LayoutPrimitives';
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
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);
      setCount(Math.floor(progress * value));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    let startTimestamp: number | null = null;
    const observer = new IntersectionObserver(
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
      observer.disconnect();
    };
  }, [value, duration, prefersReduced]);

  return (
    <div ref={elementRef} className="text-2xl sm:text-3xl font-black text-zinc-950 font-mono tracking-tight">
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

  // Scroll animation variants for alternating layout columns
  const slideLeftVariants: Variants = {
    hidden: { opacity: 0, x: prefersReduced ? 0 : -25 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const slideRightVariants: Variants = {
    hidden: { opacity: 0, x: prefersReduced ? 0 : 25 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const faqItems = [
    { title: 'How does Sculra discover website pages?', content: 'Sculra deploys an automated crawler that spider-crawls the DOM, discovering links, form inputs, button elements, and overlays without requiring manual routing maps.' },
    { title: 'Can I run Sculra inside our private VPC?', content: 'Yes, our Enterprise package supports deploying containerized, isolated QA runners within your private AWS/GCP networks.' },
    { title: 'How is sensitive credentials data secured?', content: 'All API keys, password configurations, and tokens are encrypted at rest using AES-256 standards, and database records isolation is enforced via Supabase RLS.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-950 overflow-hidden selection:bg-zinc-900 selection:text-white">
      <Navbar />

      <main className="flex-grow relative bg-white">
        {/* Subtle Ambient Texture & Soft Restrained Glows */}
        <div className="absolute inset-0 -z-20 bg-grid-ambient bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 -z-10 h-[450px] w-[700px] bg-cyan-500/8 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-[35%] right-10 -z-10 h-[500px] w-[500px] bg-indigo-500/6 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute top-[65%] left-10 -z-10 h-[500px] w-[500px] bg-cyan-500/6 rounded-full blur-[160px] pointer-events-none" />

        {/* HERO SECTION */}
        <Section className="relative pt-20 pb-16 sm:pt-28 sm:pb-24 bg-white">
          <Container>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center max-w-4xl mx-auto space-y-6 mb-16"
            >
              <motion.span
                variants={itemVariants}
                className="inline-flex items-center rounded-full bg-cyan-50 px-4 py-1.5 text-xs font-bold text-cyan-800 border border-cyan-200 uppercase tracking-widest font-mono shadow-xs"
              >
                Autonomous QA Platform
              </motion.span>
              
              <motion.h1
                variants={itemVariants}
                className="text-4xl font-black tracking-tight sm:text-6xl text-zinc-950 leading-[1.1] select-none"
              >
                Your AI QA Engineer.
                <br />
                <span className="text-gradient-brand font-black">Test everything. Autonomously.</span>
              </motion.h1>
              
              <motion.p
                variants={itemVariants}
                className="mx-auto max-w-2xl text-base sm:text-lg text-zinc-600 leading-relaxed font-normal"
              >
                Sculra crawls your application like a human QA engineer. Discover functional bugs, visual regressions, and responsive layout shifts with zero manual scripting required.
              </motion.p>

              <motion.div variants={itemVariants} className="pt-3 flex flex-col items-center gap-3">
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Link href="/sign-up">
                    <Button variant="default" size="lg" className="bg-zinc-950 text-white hover:bg-zinc-800 shadow-md font-semibold text-xs font-mono uppercase tracking-wider px-8 py-3.5 rounded-lg hover:scale-105 transition-all">
                      Start Testing Free
                    </Button>
                  </Link>
                  <Link href="/docs">
                    <Button variant="outline" size="lg" className="border-zinc-300 text-zinc-800 hover:bg-zinc-100 font-semibold text-xs font-mono uppercase tracking-wider px-8 py-3.5 rounded-lg transition-all">
                      See How It Works
                    </Button>
                  </Link>
                </div>
                {/* Risk-reversal microcopy */}
                <span className="text-xs font-medium text-zinc-500 font-mono mt-1">
                  No credit card required • Free forever plan • Cancel anytime
                </span>
              </motion.div>
            </motion.div>

            {/* Simulated Live Testing Visual Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <HeroTestingVisualization />
            </motion.div>
          </Container>
        </Section>

        {/* LIVING STATS BAR UNDER HERO */}
        <section className="py-10 border-y border-zinc-200/80 bg-zinc-50/60 relative">
          <Container>
            <Grid cols={2} colsSm={4} gap={20} className="text-center">
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono font-bold">Pages Scanned</div>
                <StatCounter value={24930} />
                <span className="text-[10px] text-zinc-400 font-mono block">[PLACEHOLDER]</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono font-bold">Regressions Blocked</div>
                <StatCounter value={1498} />
                <span className="text-[10px] text-zinc-400 font-mono block">[PLACEHOLDER]</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono font-bold">Avg. Readiness Index</div>
                <StatCounter value={91} suffix=".4%" />
                <span className="text-[10px] text-zinc-400 font-mono block">[PLACEHOLDER]</span>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono font-bold">Time to First Bug</div>
                <StatCounter value={34} suffix="s" />
                <span className="text-[10px] text-zinc-400 font-mono block">[PLACEHOLDER]</span>
              </div>
            </Grid>
          </Container>
        </section>

        {/* INFINITE BRAND MARQUEE SECTION */}
        <section className="py-8 bg-white border-b border-zinc-100">
          <Container>
            <p className="text-center text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 font-mono">
              Empowering active product developers worldwide
            </p>
            <BrandLogosMarquee />
          </Container>
        </section>

        {/* SECTION 2 - THE COMPLEXITY DILEMMA */}
        {/* Layout rhythm: Left Copy (40%), Right Visual (60%) */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-5 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    The Complexity Dilemma
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    A landscape too vast to test by hand.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Every user state, route branch, device model, and role variant creates a combinatoric explosion. Manual testing misses visual overflows and regression crashes on staging.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-7"
              >
                <TestingJourney />
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SECTION 3 - HOW IT WORKS (BALANCED FULL-WIDTH WORKFLOW + RICH DEMO) */}
        <Section className="py-24 bg-zinc-50/50 border-y border-zinc-100 relative overflow-hidden">
          <Container className="max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center max-w-2xl mx-auto mb-14 space-y-3"
            >
              <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono">
                How Sculra Works
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                Reads your UI from the outside in.
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                Sculra autonomously walks through forms, clicks interactable nodes, records traces, and checks DOM properties without any code integration required.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
            >
              <BrowserMockup />
            </motion.div>
          </Container>
        </Section>

        {/* SECTION 4 - VISUAL QA */}
        {/* Layout rhythm: Left Copy (40%), Right Visual (60%) */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-5 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    Pixel Verification
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    Checks what your users actually see.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Catch overlapping margins, text collisions, font weight mismatches, and element overflows automatically before merging a pull request.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-7"
              >
                <IssueDetection />
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SECTION 5 - RESPONSIVE TESTING */}
        {/* Layout rhythm: Visual Left (60%), Right Copy (40%) */}
        <Section className="py-24 bg-zinc-50/50 border-y border-zinc-100 relative overflow-hidden">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-7 order-2 lg:order-1"
              >
                <DevicePreview />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-5 order-1 lg:order-2 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    Device Matrix
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    Verify layouts on every viewport.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Test your interface simultaneously across mobile, tablet, and widescreen frames, highlighting layout shifts that break specific breakpoints.
                  </p>
                </Stack>
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SECTION 6 - THE AI QA MEMBER */}
        {/* Layout rhythm: Left Copy (40%), Right Visual (60%) */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-5 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    Autonomous Reasoning
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    Reasoning logs that trace every flaw.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Sculra checks browser console dumps, network responses, and API payloads to reproduce the exact steps that caused a page validation crash.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-7"
              >
                <AIEngineerPanel />
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SECTION 7 - RELEASE READINESS SCORECARD */}
        {/* Layout rhythm: Visual Left (60%), Right Copy (40%) */}
        <Section className="py-24 bg-zinc-50/50 border-y border-zinc-100 relative overflow-hidden">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-7 order-2 lg:order-1"
              >
                <ReleaseScore />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-5 order-1 lg:order-2 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    Readiness Check
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    Never guess if a build is safe to deploy.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Our release scorecard assigns a comprehensive index from 0 to 100 representing DOM stability, speed tolerances, accessibility compliance, and visual fit.
                  </p>
                </Stack>
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SECTION 8 - CI PIPELINE STATUS */}
        {/* Layout rhythm: Left Copy (40%), Right Visual (60%) */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-5 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    CI Integrations
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    Intercept bugs before they merge.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Block PR merges automatically if a code push drops your app readiness index. Sculra comments results directly inside your code branch logs.
                  </p>
                </Stack>
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-7"
              >
                <GitHubPipeline />
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SECTION 9 - MULTI-SOURCE INGESTION */}
        {/* Layout rhythm: Visual Left (60%), Right Copy (40%) */}
        <Section className="py-24 bg-zinc-50/50 border-y border-zinc-100 relative overflow-hidden">
          <Container className="max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideLeftVariants}
                className="lg:col-span-7 order-2 lg:order-1"
              >
                <SystemArchitecture />
              </motion.div>
              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-100px' }}
                variants={slideRightVariants}
                className="lg:col-span-5 order-1 lg:order-2 flex flex-col justify-center"
              >
                <Stack spacing={20} className="text-left">
                  <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono w-fit">
                    Multi-Source Ingestion
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950 leading-tight">
                    Any source format, ingested.
                  </h2>
                  <p className="text-sm sm:text-base text-zinc-600 leading-relaxed">
                    Whether you test dynamic URLs, synced repositories, ZIP folders, or desktop executable binaries, our ingestion engine handles them cleanly.
                  </p>
                </Stack>
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* MANUAL QA VS SCULRA COMPARISON TABLE (FUNCTIONAL SEMANTIC COMPARISON) */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-12 space-y-3"
            >
              <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono">
                Evaluation Matrix
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">Manual QA vs Sculra</h2>
              <p className="text-sm sm:text-base text-zinc-600">See how autonomous quality sweeps compare to standard manual testing cycles.</p>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
              className="overflow-x-auto border border-zinc-200/90 rounded-2xl bg-white shadow-md"
            >
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase text-zinc-600">
                    <th className="p-4 font-bold">Dimension</th>
                    <th className="p-4 font-bold">Manual / Scripted QA</th>
                    <th className="p-4 font-bold text-emerald-800 bg-emerald-50/50">Sculra Autonomous QA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <tr className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-bold text-zinc-900">Coverage Area</td>
                    <td className="p-4 text-zinc-500">✕ Manual check of major routes only</td>
                    <td className="p-4 text-emerald-800 font-bold bg-emerald-50/30">✓ Autonomous 100% path coverage</td>
                  </tr>
                  <tr className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-bold text-zinc-900">Execution Speed</td>
                    <td className="p-4 text-zinc-500">✕ Hours to days per release cycle</td>
                    <td className="p-4 text-emerald-800 font-bold bg-emerald-50/30">✓ Under 3 minutes per build run</td>
                  </tr>
                  <tr className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-bold text-zinc-900">Setup Overhead</td>
                    <td className="p-4 text-zinc-500">✕ Continuous selector script maintenance</td>
                    <td className="p-4 text-emerald-800 font-bold bg-emerald-50/30">✓ Zero-script instant source sync</td>
                  </tr>
                  <tr className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-bold text-zinc-900">Consistency</td>
                    <td className="p-4 text-zinc-500">✕ Flaky test selector failures</td>
                    <td className="p-4 text-emerald-800 font-bold bg-emerald-50/30">✓ Adaptive DOM-aware auto-updates</td>
                  </tr>
                  <tr className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 font-bold text-zinc-900">Availability</td>
                    <td className="p-4 text-zinc-500">✕ Limited developer bandwidth</td>
                    <td className="p-4 text-emerald-800 font-bold bg-emerald-50/30">✓ 24/7 continuous commit triggers</td>
                  </tr>
                </tbody>
              </table>
            </motion.div>
          </Container>
        </Section>

        {/* SECURITY & TRUST SECTION (BRAND & SEMANTIC ICON TINTS) */}
        <Section className="py-20 bg-zinc-50/50 border-y border-zinc-100 relative overflow-hidden">
          <Container>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-12 space-y-3"
            >
              <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono">
                Tenant Boundaries
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">Compact & Enforced Security</h2>
              <p className="text-sm sm:text-base text-zinc-600">Sculra leverages standard protocols to isolate code data and keys.</p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto font-mono text-xs leading-relaxed">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="p-6 border border-zinc-200/90 bg-white rounded-2xl space-y-3 shadow-md hover:shadow-lg transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shadow-xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div className="text-zinc-950 font-bold uppercase text-xs pt-1">Clerk Authentication</div>
                <p className="text-zinc-600 text-xs font-sans leading-relaxed">Secure identities authentication and credentials handled by Clerk OAuth.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="p-6 border border-zinc-200/90 bg-white rounded-2xl space-y-3 shadow-md hover:shadow-lg transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="text-zinc-950 font-bold uppercase text-xs pt-1">Supabase RLS Isolation</div>
                <p className="text-zinc-600 text-xs font-sans leading-relaxed">Strict multi-tenant security separation verified at database query layer using Supabase RLS.</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="p-6 border border-zinc-200/90 bg-white rounded-2xl space-y-3 shadow-md hover:shadow-lg transition-all"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div className="text-zinc-950 font-bold uppercase text-xs pt-1">Sentry Diagnostics</div>
                <p className="text-zinc-600 text-xs font-sans leading-relaxed">Continuous diagnostics monitoring and bug trace audits powered by Sentry and PostHog.</p>
              </motion.div>
            </div>
          </Container>
        </Section>

        {/* SOCIAL PROOF / TESTIMONIALS STRIP */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center mb-14 space-y-3"
            >
              <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono">
                Social Proof
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">Built for teams that ship.</h2>
              <p className="text-sm sm:text-base text-zinc-600">Here is what active engineering leaders say about using Sculra.</p>
            </motion.div>
            
            <Grid cols={1} colsMd={3} gap={24}>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="transition-all duration-300"
              >
                <div className="p-6 space-y-4 bg-white border border-zinc-200/90 rounded-2xl shadow-md hover:shadow-lg h-full flex flex-col justify-between">
                  <p className="text-xs sm:text-sm text-zinc-700 italic leading-relaxed">
                    &quot;Sculra blocked a critical payment flow overflow regression in our staging build before we pushed it live. It&apos;s like having an extra QA engineer on every PR.&quot;
                  </p>
                  <div className="pt-3 border-t border-zinc-100 font-mono text-[11px]">
                    <span className="text-zinc-950 font-bold block">[PLACEHOLDER — User Name 1]</span>
                    <span className="text-zinc-500">[PLACEHOLDER — Role 1, Company 1]</span>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="transition-all duration-300"
              >
                <div className="p-6 space-y-4 bg-white border border-zinc-200/90 rounded-2xl shadow-md hover:shadow-lg h-full flex flex-col justify-between">
                  <p className="text-xs sm:text-sm text-zinc-700 italic leading-relaxed">
                    &quot;Writing browser checks used to be an endless chore of updating selectors. Sculra spider-crawls autonomously and adapts to our DOM tweaks.&quot;
                  </p>
                  <div className="pt-3 border-t border-zinc-100 font-mono text-[11px]">
                    <span className="text-zinc-950 font-bold block">[PLACEHOLDER — User Name 2]</span>
                    <span className="text-zinc-500">[PLACEHOLDER — Role 2, Company 2]</span>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="transition-all duration-300"
              >
                <div className="p-6 space-y-4 bg-white border border-zinc-200/90 rounded-2xl shadow-md hover:shadow-lg h-full flex flex-col justify-between">
                  <p className="text-xs sm:text-sm text-zinc-700 italic leading-relaxed">
                    &quot;We synced our codebase in under 2 minutes. The release readiness score is now our single source of truth before merge approvals.&quot;
                  </p>
                  <div className="pt-3 border-t border-zinc-100 font-mono text-[11px]">
                    <span className="text-zinc-950 font-bold block">[PLACEHOLDER — User Name 3]</span>
                    <span className="text-zinc-500">[PLACEHOLDER — Role 3, Company 3]</span>
                  </div>
                </div>
              </motion.div>
            </Grid>
          </Container>
        </Section>

        {/* PRICING PREVIEW */}
        <Section className="py-24 bg-zinc-50/50 border-t border-zinc-100 relative overflow-hidden">
          <Container>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-center max-w-2xl mx-auto mb-16 space-y-3"
            >
              <span className="inline-block text-[10px] font-bold text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 uppercase tracking-wider font-mono">
                Simple Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-950">Based on how much you test.</h2>
              <p className="text-sm sm:text-base text-zinc-600">Start testing free, then scale up as your deployment quotas expand.</p>
            </motion.div>

            <Grid cols={1} colsMd={3} gap={24} className="max-w-4xl mx-auto items-stretch">
              {/* Free Plan */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                whileHover={prefersReduced ? {} : { y: -4, scale: 1.01 }}
                className="h-full"
              >
                <Card className="flex flex-col justify-between p-6 bg-white border border-zinc-200/90 rounded-2xl shadow-md hover:shadow-lg h-full">
                  <CardHeader className="p-0 pb-4">
                    <span className="text-xs font-bold text-zinc-950 font-mono">Free Plan</span>
                    <div className="text-3xl font-black text-zinc-950 mt-2 font-mono">$0</div>
                    <CardDescription className="text-xs text-zinc-500 mt-1">For exploring Sculra features</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 py-4 border-t border-b border-zinc-100 my-4">
                    <ul className="space-y-2 text-xs text-zinc-600 font-mono">
                      <li>✓ 1 Target Project limit</li>
                      <li>✓ 10 Test runs per month</li>
                      <li>✓ Standard trace logs</li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-0">
                    <Link href="/sign-up" className="w-full">
                      <Button variant="outline" className="w-full text-xs uppercase tracking-wider font-mono border-zinc-300 text-zinc-800 hover:bg-zinc-100 font-semibold py-2.5">
                        Explore Free
                      </Button>
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
                <Card className="border-2 border-zinc-950 shadow-xl flex flex-col justify-between p-6 bg-white rounded-2xl h-full relative">
                  <div className="absolute -top-3 right-6">
                    <Badge variant="accent" className="bg-zinc-950 text-white text-[10px] uppercase tracking-wider px-2.5 py-0.5 shadow-xs font-bold">
                      Popular
                    </Badge>
                  </div>
                  <CardHeader className="p-0 pb-4">
                    <span className="text-xs font-bold text-zinc-950 font-mono">Pro Plan</span>
                    <div className="text-3xl font-black text-zinc-950 mt-2 font-mono">$49</div>
                    <CardDescription className="text-xs text-zinc-500 mt-1">For active development teams</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 py-4 border-t border-b border-zinc-100 my-4">
                    <ul className="space-y-2 text-xs text-zinc-700 font-mono font-medium">
                      <li>✓ 3 Target Projects limit</li>
                      <li>✓ 100 Test runs per month</li>
                      <li>✓ Visual alignment checks</li>
                      <li>✓ Priority agent swarm</li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-0">
                    <Link href="/sign-up" className="w-full">
                      <Button variant="default" className="w-full text-xs uppercase tracking-wider font-mono bg-zinc-950 text-white hover:bg-zinc-800 font-bold py-2.5 shadow-xs">
                        Start Trial
                      </Button>
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
                <Card className="flex flex-col justify-between p-6 bg-white border border-zinc-200/90 rounded-2xl shadow-md hover:shadow-lg h-full">
                  <CardHeader className="p-0 pb-4">
                    <span className="text-xs font-bold text-zinc-950 font-mono">Team Plan</span>
                    <div className="text-3xl font-black text-zinc-950 mt-2 font-mono">$199</div>
                    <CardDescription className="text-xs text-zinc-500 mt-1">For teams shipping continuously</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 py-4 border-t border-b border-zinc-100 my-4">
                    <ul className="space-y-2 text-xs text-zinc-600 font-mono">
                      <li>✓ 10 Target Projects limit</li>
                      <li>✓ 1,000 Test runs per month</li>
                      <li>✓ Security & WCAG checks</li>
                      <li>✓ Custom runner deployment</li>
                    </ul>
                  </CardContent>
                  <CardFooter className="p-0">
                    <Link href="/sign-up" className="w-full">
                      <Button variant="outline" className="w-full text-xs uppercase tracking-wider font-mono border-zinc-300 text-zinc-800 hover:bg-zinc-100 font-semibold py-2.5">
                        Upgrade Team
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              </motion.div>
            </Grid>
            
            <div className="text-center mt-12">
              <Link href="/pricing" className="text-xs text-zinc-900 hover:text-cyan-800 font-bold font-mono transition-colors">
                View all pricing plans & add-ons →
              </Link>
            </div>
          </Container>
        </Section>

        {/* WAITLIST REGISTRATION MINI-FORM */}
        <Section className="py-16 relative overflow-hidden bg-white">
          <Container className="max-w-md text-center space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="space-y-2"
            >
              <h3 className="text-xl font-black text-zinc-950 tracking-tight">Get early updates on beta runs</h3>
              <p className="text-xs text-zinc-600">Subscribe to receive technical guides and release previews.</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-100px' }}
            >
              {waitlistSubmitted ? (
                <div className="text-xs text-cyan-800 font-bold bg-cyan-50 p-3.5 border border-cyan-200 rounded-xl font-mono">
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
                    className="flex-grow px-3.5 py-2 text-xs rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950/20"
                  />
                  <Button type="submit" variant="default" size="sm" className="bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-semibold px-4">
                    Subscribe
                  </Button>
                </form>
              )}
            </motion.div>
          </Container>
        </Section>

        {/* SECTION 15 - DRAMATIC FINAL CTA (THE ONLY DARK SECTION ON THE ENTIRE PAGE) */}
        <FinalCTA />

        {/* FAQ ACCORDION SECTION */}
        <Section className="py-24 relative overflow-hidden bg-white">
          <Container className="max-w-2xl">
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              className="text-3xl sm:text-4xl font-black tracking-tight text-center mb-12 text-zinc-950"
            >
              Frequently Asked Questions
            </motion.h2>
            <Accordion>
              {faqItems.map((faq, idx) => (
                <AccordionItem key={idx} title={faq.title}>
                  <p className="text-xs leading-relaxed text-zinc-600">{faq.content}</p>
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
