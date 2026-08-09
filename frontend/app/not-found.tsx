import * as React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Container, Section, Stack } from '@/components/LayoutPrimitives';
import { Button } from '@/components/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-grow flex items-center">
        <Section className="py-20 w-full">
          <Container className="text-center">
            <Stack spacing={24} className="max-w-md mx-auto">
              <span className="text-sm font-bold text-accent tracking-widest uppercase">404 Error</span>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Page Not Found</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The page you are looking for does not exist or has been relocated to another route.
              </p>
              <div className="mt-6 flex justify-center">
                <Link href="/">
                  <Button variant="accent">Return to Home</Button>
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
