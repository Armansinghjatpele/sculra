import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sculra - Your AI QA Engineer',
  description: 'Automated website, repo, and desktop app testing powered by AI agents.',
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
          colorText: '#09090b', // High-contrast text
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
      <html lang="en" className="h-full antialiased" suppressHydrationWarning>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
