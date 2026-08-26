import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Grid, Stack, Divider } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';

export const metadata: Metadata = {
  title: 'Pricing - Sculra AI QA Engineer',
  description: 'Flexible options for developers, startup teams, and large scale enterprises.',
};

export default function PricingPage() {
  const plans = [
    { name: 'Developer', price: '$0', desc: 'Sandbox environment for solo developers.', features: ['1 Project limit', '10 Test runs per month', '1 Seat access', 'Standard HTML trace logs'], cta: 'Start Free', variant: 'outline' as const },
    { name: 'Startup', price: '$49', desc: 'Automate deployments quality for small teams.', features: ['3 Projects limit', '100 Test runs per month', '3 Seats access', 'GitHub webhook triggers', 'Visual alignment checks'], cta: 'Get Started', variant: 'default' as const },
    { name: 'Professional', price: '$199', desc: 'Comprehensive coverage for shipping products.', features: ['10 Projects limit', '1,000 Test runs per month', '10 Seats access', 'API keys access', 'Security & Accessibility scans', 'Priority support queue'], cta: 'Upgrade to Pro', variant: 'accent' as const },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-20">
          <Container>
            <Stack spacing={32} className="text-center max-w-3xl mx-auto mb-16">
              <span className="inline-flex items-center self-center rounded-full bg-accent/10 px-3 py-1 text-3xs font-medium text-accent border border-accent/20 uppercase tracking-widest">
                Plans & Billing
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Simple pricing, no credit card required.
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Choose a plan tailored to your testing quotas. All accounts start with a 14-day Pro trial.
              </p>
            </Stack>

            <Grid cols={1} colsSm={2} colsLg={3} gap={24} className="mb-20">
              {plans.map((plan, idx) => (
                <Card key={idx} className={cn('glass-panel flex flex-col justify-between', plan.name === 'Professional' && 'border-accent/40 shadow-glass')}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{plan.name}</span>
                      {plan.name === 'Professional' && (
                        <Badge variant="accent" className="text-4xs uppercase tracking-wider py-0 px-2">Popular</Badge>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1 mt-4">
                      <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                      {plan.price !== 'Custom' && <span className="text-xs text-muted-foreground">/ month</span>}
                    </div>
                    <CardDescription className="text-xs text-muted-foreground mt-2">{plan.desc}</CardDescription>
                  </CardHeader>
                  <Divider />
                  <CardContent className="pt-6">
                    <ul className="space-y-3">
                      {plan.features.map((feat, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5 text-xs text-foreground">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4 text-accent shrink-0"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-border/20">
                    <Link href="/sign-up" className="w-full">
                      <Button variant={plan.variant} className="w-full text-xs">
                        {plan.cta}
                      </Button>
                    </Link>
                  </CardFooter>
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

// Helper to resolve Tailwind class merges inside server components
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
