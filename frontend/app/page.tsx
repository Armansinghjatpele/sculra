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

// Trust Grayscale Brand Logos SVG Primitives
import { GithubLogo, VercelLogo, StripeLogo, LinearLogo, FramerLogo } from '@/components/landing/BrandLogos';

export default function Home() {
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
      transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const faqItems = [
    { title: 'How does Sculra discover website pages?', content: 'Sculra deploys an automated crawler that spider-crawls the DOM, discovering links, form inputs, button elements, and overlays without requiring manual routing maps.' },
    { title: 'Can I run Sculra inside our private VPC?', content: 'Yes, our Enterprise package supports deploying containerized, isolated QA runners within your private AWS/GCP networks.' },
    { title: 'How is sensitive credentials data secured?', content: 'All API keys, password configurations, and tokens are encrypted at rest using AES-256 standards, and database records isolation is enforced via Supabase RLS.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-hidden">
      <Navbar />

      <main className="flex-grow">
        {/* Ambient Grid Background */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)]" />

        {/* HERO SECTION */}
        <Section className="relative pt-24 pb-20 sm:pt-32">
          {/* Ambient Accent glow circle */}
          <div className="absolute top-0 left-1/2 -z-10 h-[450px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.12),transparent_50%)]" />
          
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
                className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground leading-[1.1]"
              >
                Your AI QA Engineer.
                <br />
                <span className="text-muted-foreground">Test everything. Automatically.</span>
              </motion.h1>
              
              <motion.p
                variants={itemVariants}
                className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed"
              >
                Sculra explores your application like a real user, finds broken functionality, catches visual regressions, tests responsive layouts, and tells you whether you're ready to ship.
              </motion.p>

              <motion.div variants={itemVariants} className="pt-4 flex flex-col items-center gap-3">
                <div className="flex items-center gap-4">
                  <Link href="/sign-up">
                    <Button variant="accent" size="lg">Start Testing Free</Button>
                  </Link>
                  <Link href="/docs">
                    <Button variant="outline" size="lg">See How It Works</Button>
                  </Link>
                </div>
                {/* Risk-reversal microcopy */}
                <span className="text-5xs uppercase tracking-widest text-muted-foreground">
                  No credit card required • Free forever plan • Cancel anytime
                </span>
              </motion.div>
            </motion.div>

            {/* Simulated Live Testing Visual Mockup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
            >
              <HeroTestingVisualization />
            </motion.div>
          </Container>
        </Section>

        {/* LIVING STATS BAR UNDER HERO */}
        <section className="py-6 border-b border-border/40 bg-zinc-950/20">
          <Container>
            <Grid cols={2} colsSm={4} gap={16} className="text-center font-mono text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Pages Scanned</div>
                <div className="text-sm font-bold text-accent">[PLACEHOLDER — 24,930]</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Regressions Blocked</div>
                <div className="text-sm font-bold text-accent">[PLACEHOLDER — 1,498]</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. Readiness Index</div>
                <div className="text-sm font-bold text-accent">[PLACEHOLDER — 91.4%]</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Time to First Bug</div>
                <div className="text-sm font-bold text-accent">[PLACEHOLDER — 34s]</div>
              </div>
            </Grid>
          </Container>
        </section>

        {/* TRUST GRSCALE BRAND LOGOS SECTION */}
        <section className="py-8 bg-black/20 border-b border-border/40">
          <Container>
            <p className="text-center text-4xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">
              Empowering active product developers worldwide
            </p>
            <Flex justify="center" align="center" wrap className="gap-x-12 gap-y-6 opacity-35 hover:opacity-55 transition-opacity duration-300">
              <GithubLogo className="text-foreground transition-all h-6 w-6" />
              <VercelLogo className="text-foreground transition-all h-6 w-6" />
              <StripeLogo className="text-foreground transition-all h-6 w-10" />
              <LinearLogo className="text-foreground transition-all h-6 w-6" />
              <FramerLogo className="text-foreground transition-all h-6 w-6" />
            </Flex>
          </Container>
        </section>

        {/* SECTION 2 - THE PROBLEM (Branching complexity vs manual checks) */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 bg-black/10">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <Stack spacing={24} className="justify-center text-left">
                <span className="text-xs font-bold text-danger uppercase tracking-wider">The Complexity Dilemma</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  A landscape too vast to test by hand.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Every user state, route branch, device model, and role variant creates a combinatoric explosion. Manual testing misses visual overflows and regression crashes on staging.
                </p>
              </Stack>
              <TestingJourney />
            </Grid>
          </Container>
        </Section>

        {/* SECTION 3 - HOW IT WORKS (Connect -> Explore -> Understand -> Report) */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <div className="order-2 md:order-1">
                <BrowserMockup />
              </div>
              <Stack spacing={24} className="justify-center text-left order-1 md:order-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">How Sculra Works</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Reads your UI from the outside in.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sculra autonomously walks through forms, clicks interactable nodes, records traces, and checks DOM properties without any code integration required.
                </p>
              </Stack>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 4 - VISUAL QA (Expected vs Actual comparison highlight) */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 bg-black/10">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <Stack spacing={24} className="justify-center text-left">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Pixel Verification</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Checks what your users actually see.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Catch overlapping margins, text collisions, font weight mismatches, and element overflows automatically before merging a pull request.
                </p>
              </Stack>
              <IssueDetection />
            </Grid>
          </Container>
        </Section>

        {/* SECTION 5 - RESPONSIVE TESTING (Viewports preview) */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <div className="order-2 md:order-1">
                <DevicePreview />
              </div>
              <Stack spacing={24} className="justify-center text-left order-1 md:order-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Device Matrix</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Verify layouts on every viewport.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Test your interface simultaneously across mobile, tablet, and widescreen frames, highlighting layout shifts that break specific breakpoints.
                </p>
              </Stack>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 6 - THE AI QA MEMBER (Reasoning logs terminal) */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 bg-black/10">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <Stack spacing={24} className="justify-center text-left">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Autonomous Reasoning</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Reasoning logs that trace every flaw.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sculra checks browser console dumps, network responses, and API payloads to reproduce the exact steps that caused a page validation crash.
                </p>
              </Stack>
              <AIEngineerPanel />
            </Grid>
          </Container>
        </Section>

        {/* SECTION 7 - RELEASE READINESS SCORECARD */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <div className="order-2 md:order-1">
                <ReleaseScore />
              </div>
              <Stack spacing={24} className="justify-center text-left order-1 md:order-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Readiness Check</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Never guess if a build is safe to deploy.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Our release scorecard assigns a comprehensive index from 0 to 100 representing DOM stability, speed tolerances, accessibility compliance, and visual fit.
                </p>
              </Stack>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 8 - CI PIPELINE STATUS */}
        {/* Layout rhythm: Left Copy, Right Visual */}
        <Section className="py-24 bg-black/10">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <Stack spacing={24} className="justify-center text-left">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">CI Integrations</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Intercept bugs before they merge.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Block PR merges automatically if a code push drops your app readiness index. Sculra comments results directly inside your code branch logs.
                </p>
              </Stack>
              <GitHubPipeline />
            </Grid>
          </Container>
        </Section>

        {/* SECTION 9 - MULTI-SOURCE DIAGRAM */}
        {/* Layout rhythm: Right Copy, Left Visual */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <Grid cols={1} colsMd={2} gap={40} className="items-center">
              <div className="order-2 md:order-1">
                <SystemArchitecture />
              </div>
              <Stack spacing={24} className="justify-center text-left order-1 md:order-2">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">Multi-Source Ingestion</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
                  Any source format, ingested.
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Whether you test dynamic URLs, synced repositories, ZIP folders, or desktop executable binaries, our ingestion engine handles them cleanly.
                </p>
              </Stack>
            </Grid>
          </Container>
        </Section>

        {/* MANUAL QA VS SCULRA COMPARISON TABLE */}
        <Section className="py-24 bg-black/10">
          <Container className="max-w-4xl">
            <div className="text-center mb-12 space-y-3">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Evaluation Matrix</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Manual QA vs Sculra</h2>
              <p className="text-sm text-muted-foreground">See how autonomous quality sweeps compare to standard testing cycles.</p>
            </div>
            
            <div className="overflow-x-auto border border-white/5 rounded-xl bg-zinc-950/40">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5 text-[10px] uppercase text-muted-foreground">
                    <th className="p-4">Dimension</th>
                    <th className="p-4">Manual / Scripted QA</th>
                    <th className="p-4 text-accent">Sculra Autonomous QA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="p-4 font-semibold text-foreground">Coverage Area</td>
                    <td className="p-4 text-muted-foreground">Manual check of major routes</td>
                    <td className="p-4 text-accent font-semibold">Autonomous 100% path coverage</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-foreground">Execution Speed</td>
                    <td className="p-4 text-muted-foreground">Hours to days per cycle</td>
                    <td className="p-4 text-accent font-semibold">Minutes per build run</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-foreground">Setup Overhead</td>
                    <td className="p-4 text-muted-foreground">Continuous selector script updates</td>
                    <td className="p-4 text-accent font-semibold">Zero-script instant source sync</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-foreground">Consistency</td>
                    <td className="p-4 text-muted-foreground">Flaky test selector failures</td>
                    <td className="p-4 text-accent font-semibold">Adaptive DOM-aware updates</td>
                  </tr>
                  <tr>
                    <td className="p-4 font-semibold text-foreground">Availability</td>
                    <td className="p-4 text-muted-foreground">Scheduled developer bandwidth</td>
                    <td className="p-4 text-accent font-semibold">24/7 continuous triggers</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Container>
        </Section>

        {/* SECURITY & TRUST SECTION */}
        <Section className="py-20 bg-black/20 border-y border-border/40">
          <Container>
            <div className="text-center mb-12 space-y-3">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Tenant Boundaries</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Compact & Enforced Security</h2>
              <p className="text-sm text-muted-foreground">Sculra leverages standard protocols to isolate code data and keys.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto font-mono text-[10px] leading-relaxed">
              <div className="p-5 border border-white/5 bg-zinc-950/40 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="text-accent font-bold uppercase">Clerk Authentication</span>
                </div>
                <p className="text-muted-foreground">Secure identities authentication and credentials handled by Clerk OAuth.</p>
              </div>
              <div className="p-5 border border-white/5 bg-zinc-950/40 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-accent font-bold uppercase">Supabase RLS Isolation</span>
                </div>
                <p className="text-muted-foreground">Strict multi-tenant security separation verified at database query layer using Supabase RLS.</p>
              </div>
              <div className="p-5 border border-white/5 bg-zinc-950/40 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <span className="text-accent font-bold uppercase">Sentry Diagnostics</span>
                </div>
                <p className="text-muted-foreground">Continuous diagnostics monitoring and bug trace audits powered by Sentry and PostHog.</p>
              </div>
            </div>
          </Container>
        </Section>

        {/* SOCIAL PROOF / TESTIMONIALS STRIP */}
        <Section className="py-20 bg-black/10">
          <Container className="max-w-5xl">
            <div className="text-center mb-12 space-y-3">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Social Proof</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Built for teams that ship.</h2>
              <p className="text-sm text-muted-foreground">Here is what active engineering leaders say about using Sculra.</p>
            </div>
            
            <Grid cols={1} colsMd={3} gap={20}>
              <Card className="glass-panel p-5 space-y-3">
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  "Sculra blocked a critical payment flow overflow regression in our staging build before we pushed it live. It's like having an extra QA engineer on every PR."
                </p>
                <div className="pt-2 border-t border-white/5 font-mono text-[9px]">
                  <span className="text-foreground font-semibold block">[PLACEHOLDER — User Name 1]</span>
                  <span className="text-muted-foreground">[PLACEHOLDER — Role 1, Company 1]</span>
                </div>
              </Card>
              
              <Card className="glass-panel p-5 space-y-3">
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  "Writing browser checks used to be an endless chore of updating selectors. Sculra spider-crawls autonomously and adapts to our DOM tweaks."
                </p>
                <div className="pt-2 border-t border-white/5 font-mono text-[9px]">
                  <span className="text-foreground font-semibold block">[PLACEHOLDER — User Name 2]</span>
                  <span className="text-muted-foreground">[PLACEHOLDER — Role 2, Company 2]</span>
                </div>
              </Card>
              
              <Card className="glass-panel p-5 space-y-3">
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  "We synced our codebase in under 2 minutes. The release readiness score is now our single source of truth before merge approvals."
                </p>
                <div className="pt-2 border-t border-white/5 font-mono text-[9px]">
                  <span className="text-foreground font-semibold block">[PLACEHOLDER — User Name 3]</span>
                  <span className="text-muted-foreground">[PLACEHOLDER — Role 3, Company 3]</span>
                </div>
              </Card>
            </Grid>
          </Container>
        </Section>

        {/* PRICING PREVIEW */}
        <Section className="py-24 bg-black/20 border-t border-border/40">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Simple Pricing</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Based on how much you test.</h2>
              <p className="text-sm text-muted-foreground">Start testing free, then scale up as your deployment quotas expand.</p>
            </div>

            <Grid cols={1} colsMd={3} gap={24} className="max-w-4xl mx-auto">
              {/* Free Plan */}
              <Card className="glass-panel flex flex-col justify-between p-6">
                <CardHeader className="p-0 pb-4">
                  <span className="text-xs font-bold text-foreground">Free Plan</span>
                  <div className="text-2xl font-bold text-foreground mt-2">$0</div>
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

              {/* Pro Plan */}
              <Card className="glass-panel border-accent/40 shadow-glass flex flex-col justify-between p-6">
                <CardHeader className="p-0 pb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-foreground">Pro Plan</span>
                    <Badge variant="accent" className="text-5xs uppercase tracking-wider px-1.5 py-0">Popular</Badge>
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-2">$49</div>
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

              {/* Team Plan */}
              <Card className="glass-panel flex flex-col justify-between p-6">
                <CardHeader className="p-0 pb-4">
                  <span className="text-xs font-bold text-foreground">Team Plan</span>
                  <div className="text-2xl font-bold text-foreground mt-2">$199</div>
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
            </Grid>
            
            <div className="text-center mt-10">
              <Link href="/pricing" className="text-xs text-accent hover:underline font-semibold font-mono">
                View all pricing plans & add-ons →
              </Link>
            </div>
          </Container>
        </Section>

        {/* WAITLIST REGISTRATION MINI-FORM */}
        <Section className="py-16 bg-black/10 border-t border-border/40">
          <Container className="max-w-md text-center space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-foreground">Get early updates on beta runs</h3>
              <p className="text-xs text-muted-foreground">Subscribe to receive technical guides and release previews.</p>
            </div>

            {waitlistSubmitted ? (
              <div className="text-xs text-accent font-semibold bg-accent/5 p-3 border border-accent/20 rounded-lg">
                ✓ You've successfully subscribed to Sculra news!
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
          </Container>
        </Section>

        {/* SECTION 16 - DRAMATIC FINAL CTA */}
        <FinalCTA />

        {/* FAQ ACCORDION SECTION */}
        <Section className="py-20 bg-black/10 border-t border-border/40">
          <Container className="max-w-2xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-center mb-12">Frequently Asked Questions</h2>
            <Accordion>
              {faqItems.map((faq, idx) => (
                <AccordionItem key={idx} title={faq.title}>
                  <p className="text-xs leading-relaxed">{faq.content}</p>
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
