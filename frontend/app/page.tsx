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

export default function Home() {
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

              <motion.div variants={itemVariants} className="pt-4 flex items-center justify-center gap-4">
                <Link href="/sign-up">
                  <Button variant="accent" size="lg">Start Testing Free</Button>
                </Link>
                <Link href="/docs">
                  <Button variant="outline" size="lg">See How It Works</Button>
                </Link>
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

        {/* SECTION 2 - LOGO MARQUEE */}
        <section className="py-8 bg-black/20 border-y border-border">
          <Container>
            <p className="text-center text-4xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">
              Built for teams that ship continuously
            </p>
            <Flex justify="center" wrap className="gap-x-12 gap-y-6 opacity-35 hover:opacity-55 transition-opacity duration-300">
              <span className="font-bold tracking-tight text-foreground text-sm uppercase">GitHub</span>
              <span className="font-bold tracking-tight text-foreground text-sm uppercase">Vercel</span>
              <span className="font-bold tracking-tight text-foreground text-sm uppercase">Stripe</span>
              <span className="font-bold tracking-tight text-foreground text-sm uppercase">Linear</span>
              <span className="font-bold tracking-tight text-foreground text-sm uppercase">Framer</span>
            </Flex>
          </Container>
        </section>

        {/* SECTIONS 3 & 8 - THE PROBLEM & USER JOURNEYS */}
        <Section className="py-24 bg-black/10">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-danger uppercase tracking-wider">The Challenge</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Your application has more paths than your team can test.</h2>
              <p className="text-sm text-muted-foreground">Manual checkouts cannot catch visual collisions, viewport exceptions, and backend routing failures on every branch.</p>
            </div>
            <TestingJourney />
          </Container>
        </Section>

        {/* SECTION 4 - HOW SCULRA WORKS & FUNCTIONAL TESTING */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Execution Pipeline</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Give Sculra your application.</h2>
              <p className="text-sm text-muted-foreground">Your AI QA engineer explores it from the outside in, validating element triggers and routing bounds.</p>
            </div>
            <BrowserMockup />
          </Container>
        </Section>

        {/* SECTIONS 5 & 10 - VISUAL QA & BUG TO FIX */}
        <Section className="py-24 bg-black/10">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Visual Verification</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Because working isn't enough.</h2>
              <p className="text-sm text-muted-foreground">Sculra checks what your users actually see, identifying spacing anomalies and broken alignments.</p>
            </div>
            <IssueDetection />
          </Container>
        </Section>

        {/* SECTION 6 - RESPONSIVE TESTING */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Cross-Device Verification</span>
              <h2 className="text-3xl font-extrabold tracking-tight">One application. Every screen.</h2>
              <p className="text-sm text-muted-foreground">Validate visual integrity concurrently across Desktop, Tablet, and Mobile viewport frames.</p>
            </div>
            <DevicePreview />
          </Container>
        </Section>

        {/* SECTION 8 - THE AI QA ENGINEER */}
        <Section className="py-24 bg-black/10">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">AI Team Member</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Think of Sculra as another engineer on your team.</h2>
              <p className="text-sm text-muted-foreground">It traces logs, analyzes network requests, reproduces bugs, and flags issues automatically.</p>
            </div>
            <AIEngineerPanel />
          </Container>
        </Section>

        {/* SECTION 9 - RELEASE SCORECARD */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Stability Scoring</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Before you ship, ask Sculra.</h2>
              <p className="text-sm text-muted-foreground">A unified quality index combining layout fit, functional routing, accessibility, and speed.</p>
            </div>
            <ReleaseScore />
          </Container>
        </Section>

        {/* SECTION 11 - GITHUB / CI PIPELINE */}
        <Section className="py-24 bg-black/10">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Continuous Integration</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Every push can be tested.</h2>
              <p className="text-sm text-muted-foreground">Trigger testing sweeps automatically on pull requests. Protect release stability on every merge.</p>
            </div>
            <GitHubPipeline />
          </Container>
        </Section>

        {/* SECTION 12 - MULTI-SOURCE DIAGRAM */}
        <Section className="py-24 bg-black/20 border-y border-border/40">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Ingestion Architecture</span>
              <h2 className="text-3xl font-extrabold tracking-tight">Integrated Multi-Source Testing</h2>
              <p className="text-sm text-muted-foreground">Input target pages, repositories, or local binaries to yield reports and scorecards.</p>
            </div>
            <SystemArchitecture />
          </Container>
        </Section>

        {/* SECTION 13 - SECURITY & TRUST */}
        <Section className="py-20 bg-black/10">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto font-mono text-[10px] leading-relaxed">
              <div className="p-5 border border-white/5 bg-zinc-950/40 rounded-lg space-y-2">
                <div className="text-accent font-bold uppercase">Authentication</div>
                <p className="text-muted-foreground">Secure identities authentication and credentials handled by Clerk OAuth.</p>
              </div>
              <div className="p-5 border border-white/5 bg-zinc-950/40 rounded-lg space-y-2">
                <div className="text-accent font-bold uppercase">Data Isolation</div>
                <p className="text-muted-foreground">Strict multi-tenant security separation verified at database query layer using Supabase RLS.</p>
              </div>
              <div className="p-5 border border-white/5 bg-zinc-950/40 rounded-lg space-y-2">
                <div className="text-accent font-bold uppercase">Monitoring</div>
                <p className="text-muted-foreground">Continuous diagnostics monitoring and bug trace audits powered by Sentry and PostHog.</p>
              </div>
            </div>
          </Container>
        </Section>

        {/* SECTION 14 - SOCIAL PROOF (TEAMS THAT SHIP) */}
        <Section className="py-20 bg-black/20 border-y border-border/40">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl font-extrabold tracking-tight">Built for teams that ship.</h2>
              <p className="text-sm text-muted-foreground mt-2">Sculra powers testing pipelines across modern development environments.</p>
            </div>
            <Grid cols={1} colsSm={3} colsLg={6} gap={16} className="max-w-4xl mx-auto text-center font-mono text-[10px] font-bold text-muted-foreground uppercase">
              <div className="p-3 border border-white/5 bg-zinc-950/20 rounded">Startups</div>
              <div className="p-3 border border-white/5 bg-zinc-950/20 rounded">SaaS Teams</div>
              <div className="p-3 border border-white/5 bg-zinc-950/20 rounded">Product Teams</div>
              <div className="p-3 border border-white/5 bg-zinc-950/20 rounded">Agencies</div>
              <div className="p-3 border border-white/5 bg-zinc-950/20 rounded">Dev Teams</div>
            </Grid>
          </Container>
        </Section>

        {/* SECTION 15 - PRICING PREVIEW */}
        <Section className="py-24">
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
