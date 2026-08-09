import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Stack } from '@/components/LayoutPrimitives';

export const metadata: Metadata = {
  title: 'Terms of Service - Sculra',
  description: 'Terms and conditions for deploying autonomous testing sweeps on Sculra.',
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-16">
          <Container className="max-w-3xl">
            <Stack spacing={24}>
              <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
              <p className="text-xs text-muted-foreground">Effective Date: August 7, 2026</p>

              <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
                <p>
                  Welcome to Sculra. These terms of service govern your access to and use of our platform, testing runner clusters, and API interfaces.
                </p>
                <h3 className="text-base font-semibold text-foreground mt-6">1. Usage Quotas & Constraints</h3>
                <p>
                  You agree to use Sculra testing tools solely against targets and domains you own or have explicit authorization to inspect. Scanning third-party websites without permission is strictly prohibited.
                </p>
              </div>
            </Stack>
          </Container>
        </Section>
      </main>

      <Footer />
    </div>
  );
}
