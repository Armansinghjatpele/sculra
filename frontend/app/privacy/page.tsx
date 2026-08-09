import * as React from 'react';
import { Metadata } from 'next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Stack } from '@/components/LayoutPrimitives';

export const metadata: Metadata = {
  title: 'Privacy Policy - Sculra',
  description: 'Learn how Sculra secures and manages code datasets, screenshots metadata, and integration keys.',
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow">
        <Section className="py-16">
          <Container className="max-w-3xl">
            <Stack spacing={24}>
              <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
              <p className="text-xs text-muted-foreground">Effective Date: August 7, 2026</p>
              
              <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">
                <p>
                  At Sculra, we value your privacy and security. This privacy policy describes how we collect, store, and manage user metadata, integration keys, screenshots storage, and code history details.
                </p>
                <h3 className="text-base font-semibold text-foreground mt-6">1. Data Storage & Encryption</h3>
                <p>
                  All credentials, API keys, and repository variables are encrypted at rest using AES-256 standards. Static test outputs (such as browser screenshots and video screencasts) are stored in private Supabase Storage buckets, secured by RLS policies.
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
