import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Stack } from '@/components/LayoutPrimitives';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/Card';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';

export const metadata: Metadata = {
  title: 'Contact - Sculra',
  description: 'Get in touch with our engineering and enterprise sales teams.',
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-20">
          <Container className="max-w-xl">
            <Card className="glass-panel">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Contact Sales & Support</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-2">
                  Have questions about private runner deployments or Custom plans? Write us a message.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Work Email</label>
                  <Input type="email" placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Message</label>
                  <textarea
                    rows={4}
                    placeholder="How can we help?"
                    className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 border-t border-border/20 pt-4">
                <Button variant="accent">Send Message</Button>
              </CardFooter>
            </Card>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
