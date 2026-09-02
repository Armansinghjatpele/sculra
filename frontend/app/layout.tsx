import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Sculra - Your AI QA Engineer',
  description: 'Autonomous QA agent for functional testing, visual regressions, responsive layout verification, and release readiness scoring.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#0284c7', // Cyan accent
          colorBackground: '#ffffff', // Clean white background
          colorInputBackground: '#f4f4f5', // Input background
          colorText: '#0a0a0f', // High-contrast text
          colorTextSecondary: '#71717a', // Secondary text
          colorBorder: '#e4e4e7', // Thin slate borders
        },
        elements: {
          card: 'border border-zinc-200 bg-white shadow-md rounded-2xl',
          headerTitle: 'font-bold text-zinc-950',
          headerSubtitle: 'text-xs text-zinc-500',
          socialButtonsBlockButton: 'border border-zinc-200 hover:bg-zinc-50 text-zinc-900 bg-white shadow-xs',
          socialButtonsBlockButtonText: 'font-medium',
          formButtonPrimary: 'bg-zinc-950 hover:bg-zinc-800 text-white font-semibold',
          footerActionText: 'text-zinc-500',
          footerActionLink: 'text-cyan-700 hover:underline font-semibold',
        }
      }}
    >
      <html lang="en" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
        <body className="min-h-full flex flex-col bg-background text-foreground font-sans selection:bg-zinc-900 selection:text-white">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
