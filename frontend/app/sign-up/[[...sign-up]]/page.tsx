import * as React from 'react';
import { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/Card';

export const metadata: Metadata = {
  title: 'Sign Up - Sculra',
  robots: 'noindex, nofollow',
};

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12 relative overflow-hidden">
      {/* Ambient Grid Background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_80%,transparent_100%)]" />

      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -z-10 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(circle,rgba(0,212,255,0.05),transparent_60%)]" />

      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        {/* Sculra Brand Header */}
        <Link href="/" className="flex items-center space-x-2 select-none">
          <span className="text-xl font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <svg
              className="h-5 w-5 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Sculra
          </span>
        </Link>

        {/* Custom Card Layout Wrapper */}
        <Card className="glass-panel w-full p-8 text-center flex flex-col items-center space-y-6">
          <CardHeader className="p-0 space-y-1.5">
            <CardTitle className="text-xl font-bold text-foreground">Welcome to Sculra</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Your AI QA Engineer.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-0 w-full flex justify-center">
            {/* Custom styled Clerk component to show ONLY OAuth integrations */}
            <SignUp
              path="/sign-up"
              routing="path"
              signInUrl="/sign-in"
              fallbackRedirectUrl="/dashboard"
              appearance={{
                elements: {
                  card: 'bg-transparent border-0 shadow-none p-0 w-full',
                  header: 'hidden', // Hides default Clerk title and subtitle
                  form: 'hidden', // Hides all email/username/password inputs
                  dividerRow: 'hidden', // Hides the "or" text divider line
                  footer: 'hidden', // Hides footer links
                  rootBox: 'w-full',
                }
              }}
            />
          </CardContent>

          <div className="border-t border-border/20 pt-4 w-full text-center">
            <p className="text-4xs text-muted-foreground font-medium uppercase tracking-wider">
              Secure authentication powered by Clerk
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
