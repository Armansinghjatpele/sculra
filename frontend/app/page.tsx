'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, Variants } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Accordion, AccordionItem } from '@/components/Accordion';
import { Container, Section, Grid, Flex, Stack, Divider } from '@/components/LayoutPrimitives';
import { ReleaseScoreWidget, BugCounterWidget, AIInsightsWidget } from '@/components/DashboardWidgets';

export default function Home() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const featureCards = [
    { title: 'Website Scanning', desc: 'Spider crawling discovery scripts map pages and locate interactive forms automatically.' },
    { title: 'GitHub PR Validation', desc: 'Automate synthetic test runs on active branches before merge approval.' },
    { title: 'ZIP Bundle Upload', desc: 'Drag-and-drop code assets to check load size tolerances and image compression.' },
    { title: 'Desktop Executable Scans', desc: 'Verify desktop packages across Windows, Mac, and Linux environments.' },
    { title: 'Performance Budgeting', desc: 'Intercept heavy bundles, slow API calls, and DOM weight metrics.' },
    { title: 'Accessibility Compliance', desc: 'Ensure WCAG AA contrast balances and screen reader support.' },
    { title: 'Security Vulnerabilities Checks', desc: 'Audit cookies directives, CORS access permissions, and SSL configurations.' },
    { title: 'Visual Diffs Verification', desc: 'Pixel-perfect visual assertions matching original Figma templates.' },
    { title: 'Release Scorecard', desc: 'Continuous overall stability index representing release readiness.' },
    { title: 'AI Recommendation Fixes', desc: 'Actionable code recommendations detailing exact bugs solutions.' },
  ];

  const faqItems = [
    { title: 'How does Sculra discover website pages?', content: 'Sculra deploys an automated crawler that spider-crawls the DOM, discovering links, form inputs, button elements, and overlays without requiring manual routing maps.' },
    { title: 'Can I run Sculra inside our private VPC?', content: 'Yes, our Enterprise package supports deploying containerized, isolated QA runners within your private AWS/GCP networks.' },
    { title: 'How is sensitive credentials data secured?', content: 'All API keys, password configurations, and tokens are encrypted at rest using AES-256 standards, and database records isolation is enforced via Supabase RLS.' },
  ];

  const agentSwarm = [
    { name: 'Tester Agent', role: 'Forms explorer & clicker', details: 'Executes workflows and clicks button grids.' },
    { name: 'Designer Agent', role: 'Visual diff checker', details: 'Compares screenshots to spot alignment bugs.' },
    { name: 'Security Agent', role: 'Vulnerability scanner', details: 'Audits cookie security and CORS permissions.' },
    { name: 'Accessibility Agent', role: 'WCAG compliance auditor', details: 'Checks ARIA attributes and contrast weights.' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground overflow-hidden">
      <Navbar />

      <main className="flex-grow">
        {/* Ambient Grid Background */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)]" />

        {/* Hero Section */}
        <Section className="relative pt-24 pb-20 sm:pt-32">
          {/* Accent glow circle */}
          <div className="absolute top-0 left-1/2 -z-10 h-[450px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.12),transparent_50%)]" />
          
          <Container>
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="text-center max-w-4xl mx-auto space-y-6"
            >
              <motion.span
                variants={itemVariants}
                className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest"
              >
                AI QA Engineer
              </motion.span>
              
              <motion.h1
                variants={itemVariants}
                className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground leading-[1.1]"
              >
                Confidently ship software with <span className="text-accent">Sculra</span>
              </motion.h1>
              
              <motion.p
                variants={itemVariants}
                className="mx-auto max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed"
              >
                Deploy an autonomous swarm of AI quality engineers to crawl interfaces, detect visual bugs, run security checks, and assess release readiness.
              </motion.p>

              <motion.div variants={itemVariants} className="pt-4 flex items-center justify-center gap-4">
                <Link href="/register">
                  <Button variant="accent" size="lg">Start Free Trial</Button>
                </Link>
                <Link href="/docs">
                  <Button variant="outline" size="lg">Watch Demo</Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Interactive Simulated QA Viewport Dashboard */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
              className="mt-16 rounded-xl border border-border bg-card/25 p-4 shadow-glass backdrop-blur-md max-w-4xl mx-auto"
            >
              <div className="flex items-center gap-2 pb-3 border-b border-border/40 mb-4 text-3xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-2 font-mono">sculra-runner-cluster-01 // active_session</span>
              </div>

              <Grid cols={1} colsMd={3} gap={16}>
                <ReleaseScoreWidget score={94} />
                <BugCounterWidget counts={{ critical: 0, high: 1, medium: 2, low: 4 }} />
                <AIInsightsWidget
                  insights={[
                    { id: '1', agent: 'Security Agent', severity: 'high', finding: 'Missing HttpOnly flag in session cookie.', recommendation: 'Update express-session settings to set httpOnly: true.' }
                  ]}
                />
              </Grid>
            </motion.div>
          </Container>
        </Section>

        {/* Trusted By Grid */}
        <section className="py-8 bg-black/20 border-y border-border">
          <Container>
            <p className="text-center text-4xs font-semibold text-muted-foreground uppercase tracking-widest mb-6">
              Empowering developers at modern teams
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

        {/* Problem & Solution */}
        <Section className="py-20 bg-black/40">
          <Container>
            <Grid cols={1} colsMd={2} gap={40}>
              <Stack spacing={24} className="justify-center">
                <span className="text-xs font-bold text-danger uppercase tracking-wider">The Problem</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                  Manual testing cannot keep up with active deployment releases.
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Writing and updating Cypress/Playwright scripts manually takes hours, often breaking during minor DOM adjustments, while manual verification blocks shipping targets.
                </p>
              </Stack>
              <Stack spacing={24} className="justify-center border-l border-border pl-0 md:pl-10">
                <span className="text-xs font-bold text-accent uppercase tracking-wider">The Solution</span>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
                  Autonomous agents that adapt to layout changes.
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Sculra AI agents spider-crawl target pages, adapt to style changes, write custom validation checks, and compile detailed release scorecards.
                </p>
              </Stack>
            </Grid>
          </Container>
        </Section>

        {/* Feature Cards Grid */}
        <Section className="py-20">
          <Container>
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <h2 className="text-3xl font-extrabold tracking-tight">Built for modern developer teams</h2>
              <p className="text-sm text-muted-foreground">Every check required to confidently release quality software is integrated.</p>
            </div>

            <Grid cols={1} colsSm={2} colsLg={3} gap={20}>
              {featureCards.map((feat, idx) => (
                <Card key={idx} className="glass-panel glass-interactive">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">{feat.title}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {feat.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </Grid>
          </Container>
        </Section>

        {/* AI Agent Swarm */}
        <Section className="py-20 bg-black/30 border-y border-border">
          <Container>
            <Grid cols={1} colsMd={2} gap={40}>
              <Stack spacing={24} className="justify-center">
                <span className="inline-flex items-center self-start rounded-full bg-primary/10 px-2.5 py-0.5 text-4xs font-semibold text-primary border border-primary/20 uppercase tracking-widest">
                  Agent Orchestration
                </span>
                <h2 className="text-3xl font-extrabold tracking-tight">The AI Agent Swarm</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Sculra leverages separate specialized agents working in parallel to inspect your application from every angle. If the Designer agent spots layout flaws, the PM agent instantly files a bug ticket.
                </p>
              </Stack>

              <Grid cols={1} colsSm={2} gap={16}>
                {agentSwarm.map((agent, idx) => (
                  <Card key={idx} className="glass-panel border-border/50 bg-card/15">
                    <CardHeader className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{agent.name}</span>
                        <span className="text-4xs text-muted-foreground tracking-wider uppercase">{agent.role}</span>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
                        {agent.details}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </Grid>
            </Grid>
          </Container>
        </Section>

        {/* FAQ Accordion */}
        <Section className="py-20">
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

        {/* Call to Action Section */}
        <Section className="relative py-24 bg-card/15 border-t border-border overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,rgba(0,212,255,0.06),transparent_60%)]" />
          <Container className="text-center max-w-xl">
            <Stack spacing={24}>
              <h2 className="text-3xl font-extrabold tracking-tight">Ready to automate your QA grid?</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sync your GitHub repo or connect a target URL to deploy autonomous testing sweeps.
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/register">
                  <Button variant="accent" size="lg">Start Free Trial</Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" size="lg">View Pricing Plans</Button>
                </Link>
              </div>
            </Stack>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
